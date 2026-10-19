//! Backups `.clarabak`, rotação, verificação e restauro.
//!
//! Formato: `CLARABAK` + versão (u32 LE) + tamanho do cabeçalho (u32 LE) +
//! cabeçalho JSON + bytes da base. A base já está cifrada pelo SQLCipher
//! (com HMAC por página); o cabeçalho leva as chaves embrulhadas, que sem a
//! palavra-passe ou a chave de papel não revelam nada, e o SHA-256 da base
//! para detetar ficheiros truncados ou danificados.
//!
//! O mesmo código serve a app (com a base aberta, mas sem transação a
//! decorrer) e a tarefa agendada (com a app fechada ou bloqueada): em ambos
//! os casos copia-se o ficheiro cifrado tal como está, sem o decifrar.

use chrono::{DateTime, Datelike, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};
use crate::keys::{KeyFile, SecretKind};
use crate::paths::DataDir;
use crate::vault::ProcessLock;
use crate::{db, migrations, settings, TZ};

const MAGIC: &[u8; 8] = b"CLARABAK";
const FORMAT: u32 = 1;
pub const EXTENSION: &str = "clarabak";
pub const KEEP_DAILY: usize = 7;
pub const KEEP_WEEKLY: usize = 4;
const MAX_HEADER: u32 = 1024 * 1024;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    App,
    Agendado,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Source::App => "app",
            Source::Agendado => "agendado",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Header {
    pub format: u32,
    pub created_at: String,
    pub source: Source,
    pub app_version: String,
    pub db_bytes: u64,
    pub db_sha256: String,
    pub keyfile: KeyFile,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunRecord {
    pub id: String,
    pub started_at: String,
    pub finished_at: String,
    pub source: Source,
    pub ok: bool,
    pub file_name: Option<String>,
    pub bytes: Option<u64>,
    pub error: Option<String>,
}

/// `backup-status.json`: estado legível sem palavra-passe, sem dados de negócio.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct StatusFile {
    pub last_success: Option<RunRecord>,
    pub last_attempt: Option<RunRecord>,
    #[serde(default)]
    pub recent: Vec<RunRecord>,
}

impl StatusFile {
    pub fn load(dd: &DataDir) -> Self {
        std::fs::read_to_string(dd.backup_status())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn push(&mut self, r: RunRecord) {
        if r.ok {
            self.last_success = Some(r.clone());
        }
        self.last_attempt = Some(r.clone());
        self.recent.push(r);
        let n = self.recent.len();
        if n > 60 {
            self.recent.drain(..n - 60);
        }
    }

    fn save(&self, dd: &DataDir) -> Result<()> {
        crate::paths::write_atomic(&dd.backup_status(), serde_json::to_string_pretty(self)?.as_bytes())?;
        Ok(())
    }

    pub fn last_success_at(&self) -> Option<DateTime<Utc>> {
        self.last_success
            .as_ref()
            .and_then(|r| DateTime::parse_from_rfc3339(&r.finished_at).ok())
            .map(|d| d.with_timezone(&Utc))
    }
}

fn sha256_hex(b: &[u8]) -> String {
    hex::encode(Sha256::digest(b))
}

pub fn file_name_for(t: DateTime<Utc>) -> String {
    format!("clara-{}.{EXTENSION}", t.with_timezone(&TZ).format("%Y-%m-%d_%H%M%S"))
}

fn parse_file_name(name: &str) -> Option<chrono::NaiveDateTime> {
    let stem = name.strip_prefix("clara-")?.strip_suffix(&format!(".{EXTENSION}"))?;
    chrono::NaiveDateTime::parse_from_str(stem, "%Y-%m-%d_%H%M%S").ok()
}

pub fn encode(header: &Header, db_bytes: &[u8]) -> Result<Vec<u8>> {
    let h = serde_json::to_vec(header)?;
    let mut out = Vec::with_capacity(16 + h.len() + db_bytes.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&FORMAT.to_le_bytes());
    out.extend_from_slice(&(h.len() as u32).to_le_bytes());
    out.extend_from_slice(&h);
    out.extend_from_slice(db_bytes);
    Ok(out)
}

pub fn decode(bytes: &[u8]) -> Result<(Header, &[u8])> {
    let bad = |m: &str| ClaraError::InvalidBackup(m.to_string());
    if bytes.len() < 16 || &bytes[..8] != MAGIC {
        return Err(bad("não é um backup da Clara"));
    }
    let format = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    if format != FORMAT {
        return Err(ClaraError::UnsupportedFormat);
    }
    let hlen = u32::from_le_bytes(bytes[12..16].try_into().unwrap());
    if hlen > MAX_HEADER || 16 + hlen as usize > bytes.len() {
        return Err(bad("cabeçalho danificado"));
    }
    let header: Header = serde_json::from_slice(&bytes[16..16 + hlen as usize]).map_err(|_| bad("cabeçalho ilegível"))?;
    let body = &bytes[16 + hlen as usize..];
    if body.len() as u64 != header.db_bytes {
        return Err(bad("ficheiro incompleto"));
    }
    if sha256_hex(body) != header.db_sha256 {
        return Err(bad("conteúdo danificado"));
    }
    Ok((header, body))
}

/// Gera o pacote a partir dos ficheiros em disco. Quem chama garante que
/// não há escrita a decorrer (app: sem transação aberta; tarefa: bloqueio).
fn package(dd: &DataDir, clock: &dyn Clock, source: Source) -> Result<Vec<u8>> {
    if dd.db_journal().exists() {
        return Err(ClaraError::Integrity(
            "a base ficou com uma operação por concluir; abre a Clara uma vez para a recuperar".into(),
        ));
    }
    let keyfile = KeyFile::from_json(&std::fs::read_to_string(dd.keys())?)?;
    let db_bytes = std::fs::read(dd.db())?;
    let header = Header {
        format: FORMAT,
        created_at: ts(clock.now()),
        source,
        app_version: env!("CARGO_PKG_VERSION").into(),
        db_bytes: db_bytes.len() as u64,
        db_sha256: sha256_hex(&db_bytes),
        keyfile,
    };
    encode(&header, &db_bytes)
}

fn check_dir(dir: &Path) -> Result<()> {
    if !dir.is_dir() {
        return Err(ClaraError::BackupDirUnavailable(format!("{} não existe", dir.display())));
    }
    let probe = dir.join(".clara-teste-escrita");
    std::fs::write(&probe, b"ok").map_err(|e| ClaraError::BackupDirUnavailable(e.to_string()))?;
    let _ = std::fs::remove_file(probe);
    Ok(())
}

fn write_package(dir: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf> {
    let final_path = dir.join(name);
    let partial = dir.join(format!("{name}.partial"));
    {
        use std::io::Write;
        let mut f = std::fs::File::create(&partial)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    // Confirma que o que ficou escrito é legível antes de lhe dar o nome final.
    decode(&std::fs::read(&partial)?)?;
    std::fs::rename(&partial, &final_path)?;
    Ok(final_path)
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupFile {
    pub file_name: String,
    pub path: String,
    pub bytes: u64,
    pub created_local: String,
}

pub fn list_backups(dir: &Path) -> Result<Vec<BackupFile>> {
    let mut out = vec![];
    for e in std::fs::read_dir(dir)?.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if let Some(dt) = parse_file_name(&name) {
            out.push(BackupFile {
                bytes: e.metadata().map(|m| m.len()).unwrap_or(0),
                path: e.path().to_string_lossy().to_string(),
                created_local: dt.format("%d/%m/%Y %H:%M").to_string(),
                file_name: name,
            });
        }
    }
    out.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(out)
}

/// Escolhe o que manter: o mais recente de cada um dos últimos 7 dias com
/// backup e o mais recente de cada uma das últimas 4 semanas com backup.
pub fn select_to_keep(names: &[String]) -> BTreeSet<String> {
    let mut dated: Vec<(chrono::NaiveDateTime, &String)> =
        names.iter().filter_map(|n| parse_file_name(n).map(|d| (d, n))).collect();
    dated.sort_by(|a, b| b.0.cmp(&a.0));
    let mut keep = BTreeSet::new();
    let mut days: Vec<NaiveDate> = vec![];
    let mut weeks: Vec<(i32, u32)> = vec![];
    for (dt, name) in &dated {
        let d = dt.date();
        if !days.contains(&d) && days.len() < KEEP_DAILY {
            days.push(d);
            keep.insert((*name).clone());
        }
        let w = (d.iso_week().year(), d.iso_week().week());
        if !weeks.contains(&w) && weeks.len() < KEEP_WEEKLY {
            weeks.push(w);
            keep.insert((*name).clone());
        }
    }
    keep
}

/// Apaga cópias fora da rotação e restos `.partial` com mais de um dia.
/// Só toca em ficheiros com o padrão de nome da Clara.
pub fn rotate(dir: &Path, clock: &dyn Clock) -> Result<Vec<String>> {
    let names: Vec<String> = list_backups(dir)?.into_iter().map(|b| b.file_name).collect();
    let keep = select_to_keep(&names);
    let mut removed = vec![];
    for n in names.iter().filter(|n| !keep.contains(*n)) {
        std::fs::remove_file(dir.join(n))?;
        removed.push(n.clone());
    }
    let now = std::time::SystemTime::from(clock.now());
    for e in std::fs::read_dir(dir)?.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with("clara-") && name.ends_with(".partial") {
            let old = e
                .metadata()
                .and_then(|m| m.modified())
                .map(|m| now.duration_since(m).map(|d| d.as_secs() > 86_400).unwrap_or(false))
                .unwrap_or(false);
            if old {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
    Ok(removed)
}

fn run(dd: &DataDir, clock: &dyn Clock, dir: &Path, source: Source) -> RunRecord {
    let started = clock.now();
    let id = uuid::Uuid::new_v4().to_string();
    let result = (|| -> Result<(String, u64)> {
        check_dir(dir)?;
        let bytes = package(dd, clock, source)?;
        let name = file_name_for(started);
        write_package(dir, &name, &bytes)?;
        rotate(dir, clock)?;
        Ok((name, bytes.len() as u64))
    })();
    let (ok, file_name, bytes, error) = match result {
        Ok((n, b)) => (true, Some(n), Some(b), None),
        Err(e) => (false, None, None, Some(e.to_string())),
    };
    RunRecord { id, started_at: ts(started), finished_at: ts(clock.now()), source, ok, file_name, bytes, error }
}

fn insert_run(conn: &Connection, r: &RunRecord) -> Result<bool> {
    let n = conn.execute(
        "INSERT OR IGNORE INTO backup_run (id, started_at, finished_at, source, status, file_name, bytes, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            r.id,
            r.started_at,
            r.finished_at,
            r.source.as_str(),
            if r.ok { "ok" } else { "falhou" },
            r.file_name,
            r.bytes.map(|b| b as i64),
            r.error
        ],
    )?;
    Ok(n == 1)
}

fn run_event(r: &RunRecord) -> NewEvent {
    let who = match r.source {
        Source::App => "pela app",
        Source::Agendado => "pela tarefa agendada",
    };
    let (action, summary) = if r.ok {
        ("backup.criado", format!("Backup criado {who}: {}", r.file_name.clone().unwrap_or_default()))
    } else {
        ("backup.falhou", format!("Backup falhou {who}: {}", r.error.clone().unwrap_or_default()))
    };
    NewEvent::new("backup", Some(&r.id), action, summary).origin(r.source.as_str())
}

/// Backup feito pela app desbloqueada. Fora de qualquer transação.
pub fn backup_from_app(conn: &Connection, dd: &DataDir, clock: &dyn Clock, dir: &Path) -> Result<RunRecord> {
    if !conn.is_autocommit() {
        return Err(ClaraError::Invalid("há uma operação a decorrer; tenta outra vez".into()));
    }
    let r = run(dd, clock, dir, Source::App);
    let mut status = StatusFile::load(dd);
    status.push(r.clone());
    status.save(dd)?;
    insert_run(conn, &r)?;
    history::record(conn, clock, Actor::Andreia, run_event(&r))?;
    Ok(r)
}

#[derive(Debug, PartialEq, Eq)]
pub enum ScheduledOutcome {
    Done(bool),
    /// A Clara está aberta e desbloqueada: é ela que faz o backup.
    SkippedAppOpen,
    NotConfigured,
}

/// Modo `--scheduled-backup`: copia sem abrir a base. Nunca precisa da palavra-passe.
pub fn scheduled_backup(dd: &DataDir, clock: &dyn Clock, dir: Option<&Path>) -> Result<ScheduledOutcome> {
    if !dd.is_initialized() {
        return Ok(ScheduledOutcome::NotConfigured);
    }
    let Some(_lock) = ProcessLock::try_acquire(dd)? else {
        return Ok(ScheduledOutcome::SkippedAppOpen);
    };
    let r = match dir {
        Some(d) => run(dd, clock, d, Source::Agendado),
        None => {
            let now = ts(clock.now());
            RunRecord {
                id: uuid::Uuid::new_v4().to_string(),
                started_at: now.clone(),
                finished_at: now,
                source: Source::Agendado,
                ok: false,
                file_name: None,
                bytes: None,
                error: Some(ClaraError::NoBackupDir.to_string()),
            }
        }
    };
    let mut status = StatusFile::load(dd);
    let ok = r.ok;
    status.push(r);
    status.save(dd)?;
    Ok(ScheduledOutcome::Done(ok))
}

/// Ao desbloquear: passa para a base e para o histórico os backups da tarefa agendada.
pub fn import_scheduled_runs(conn: &mut Connection, dd: &DataDir, clock: &dyn Clock) -> Result<usize> {
    let status = StatusFile::load(dd);
    let tx = conn.transaction()?;
    let mut n = 0;
    for r in status.recent.iter().filter(|r| r.source == Source::Agendado) {
        if insert_run(&tx, r)? {
            history::record(&tx, clock, Actor::Sistema, run_event(r))?;
            n += 1;
        }
    }
    settings::put(&tx, clock, settings::LAST_IMPORTED_RUN_KEY, &ts(clock.now()))?;
    tx.commit()?;
    Ok(n)
}

pub fn last_success_from_db(conn: &Connection) -> Result<Option<String>> {
    Ok(conn
        .query_row("SELECT max(finished_at) FROM backup_run WHERE status = 'ok'", [], |r| r.get::<_, Option<String>>(0))
        .optional()?
        .flatten())
}

#[derive(Clone, Debug, Serialize)]
pub struct VerifyReport {
    pub file_name: String,
    pub created_at: String,
    pub source: Source,
    pub app_version: String,
    pub schema_version: i64,
    pub cipher_version: String,
    pub portals: i64,
    pub properties: i64,
    pub listings: i64,
    pub issues: i64,
    pub history_events: i64,
    pub history_chain_ok: bool,
    pub history_problem: Option<String>,
}

fn read_limited(path: &Path) -> Result<Vec<u8>> {
    let meta = std::fs::metadata(path)?;
    if meta.len() > 2 * 1024 * 1024 * 1024 {
        return Err(ClaraError::InvalidBackup("ficheiro demasiado grande".into()));
    }
    let mut v = Vec::with_capacity(meta.len() as usize);
    std::fs::File::open(path)?.read_to_end(&mut v)?;
    Ok(v)
}

/// Abre a cópia numa pasta temporária, só para leitura, e confere tudo.
/// Devolve também o ficheiro temporário para o restauro o poder reutilizar.
fn verify_into(path: &Path, kind: SecretKind, secret: &str, tmp_dir: &Path) -> Result<(VerifyReport, Header, PathBuf)> {
    let bytes = read_limited(path)?;
    let (header, body) = decode(&bytes)?;
    let master = header.keyfile.unlock(kind, secret)?;
    std::fs::create_dir_all(tmp_dir)?;
    let tmp_db = tmp_dir.join(format!("verificar-{}.db", uuid::Uuid::new_v4()));
    std::fs::write(&tmp_db, body)?;
    let report = (|| -> Result<VerifyReport> {
        let conn = db::open_read_only(&tmp_db, &master)?;
        db::integrity(&conn)?;
        let chain = history::verify_chain(&conn)?;
        let schema_version = migrations::current_version(&conn)?;
        // Cópias da fundação continuam válidas, sem migrar a base de verificação.
        let (properties, listings, issues) = if schema_version >= 3 {
            (conn.query_row("SELECT count(*) FROM property", [], |r| r.get(0))?,
             conn.query_row("SELECT count(*) FROM listing", [], |r| r.get(0))?,
             conn.query_row("SELECT count(*) FROM issue", [], |r| r.get(0))?)
        } else { (0, 0, 0) };
        let r = VerifyReport {
            file_name: path.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default(),
            created_at: header.created_at.clone(),
            source: header.source,
            app_version: header.app_version.clone(),
            schema_version,
            cipher_version: db::cipher_version(&conn)?,
            portals: crate::catalog::count(&conn)?,
            properties,
            listings,
            issues,
            history_events: chain.events,
            history_chain_ok: chain.ok,
            history_problem: chain.problem,
        };
        drop(conn);
        Ok(r)
    })();
    match report {
        Ok(r) => Ok((r, header, tmp_db)),
        Err(e) => {
            let _ = std::fs::remove_file(&tmp_db);
            Err(e)
        }
    }
}

/// "Testar restauro": verifica a cópia e não altera nada.
pub fn verify_backup(dd: &DataDir, path: &Path, kind: SecretKind, secret: &str) -> Result<VerifyReport> {
    let (report, _, tmp) = verify_into(path, kind, secret, &dd.tmp())?;
    let _ = std::fs::remove_file(tmp);
    Ok(report)
}

/// Regista no histórico um teste de restauro (com a app desbloqueada).
pub fn record_verification(conn: &Connection, clock: &dyn Clock, r: &VerifyReport) -> Result<()> {
    let summary = if r.history_chain_ok {
        format!("Restauro testado com sucesso: {} ({} eventos, {} destinos)", r.file_name, r.history_events, r.portals)
    } else {
        format!("Restauro testado com problemas: {}", r.file_name)
    };
    history::record(conn, clock, Actor::Andreia, NewEvent::new("backup", None, "backup.testado", summary))?;
    Ok(())
}

#[derive(Clone, Debug, Serialize)]
pub struct RestoreResult {
    pub report: VerifyReport,
    pub previous_saved_as: Option<String>,
}

/// Restaura uma cópia para a pasta de dados. A Clara tem de estar bloqueada
/// ou fechada. A base anterior, se existir, é guardada ao lado com outro nome.
pub fn restore(dd: &DataDir, clock: &dyn Clock, path: &Path, kind: SecretKind, secret: &str) -> Result<RestoreResult> {
    dd.ensure()?;
    let _lock = ProcessLock::try_acquire(dd)?.ok_or(ClaraError::AlreadyOpen)?;
    let (report, header, tmp_db) = verify_into(path, kind, secret, &dd.tmp())?;
    if !report.history_chain_ok {
        let _ = std::fs::remove_file(&tmp_db);
        return Err(ClaraError::Integrity(report.history_problem.unwrap_or_else(|| "histórico inconsistente".into())));
    }
    let stamp = clock.now().with_timezone(&TZ).format("%Y%m%d-%H%M%S").to_string();
    let mut previous = None;
    if dd.db().exists() || dd.keys().exists() {
        let folder = dd.root().join(format!("antes-do-restauro-{stamp}"));
        std::fs::create_dir_all(&folder)?;
        for p in [dd.db(), dd.keys(), dd.db_journal()] {
            if p.exists() {
                std::fs::rename(&p, folder.join(p.file_name().unwrap()))?;
            }
        }
        previous = Some(folder.to_string_lossy().to_string());
    }
    std::fs::rename(&tmp_db, dd.db())?;
    crate::paths::write_atomic(&dd.keys(), header.keyfile.to_json()?.as_bytes())?;
    Ok(RestoreResult { report, previous_saved_as: previous })
}

/// Depois de desbloquear uma base restaurada, regista o restauro.
pub fn record_restore(conn: &Connection, clock: &dyn Clock, r: &RestoreResult) -> Result<()> {
    history::record(
        conn,
        clock,
        Actor::Andreia,
        NewEvent::new("backup", None, "backup.restaurado", format!("Base restaurada a partir de {}", r.report.file_name))
            .payload(serde_json::json!({ "backup_criado_em": r.report.created_at, "anterior_guardada_em": r.previous_saved_as })),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::FixedClock;
    use crate::keys::KdfParams;
    use crate::vault::Vault;
    use std::sync::Arc;

    const PW: &str = "frase de teste comprida";

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    fn setup() -> (tempfile::TempDir, tempfile::TempDir, Arc<FixedClock>, Vault, String) {
        let data = tempfile::tempdir().unwrap();
        let out = tempfile::tempdir().unwrap();
        let clock = Arc::new(FixedClock::new(utc("2026-10-17T21:00:00Z")));
        let mut v = Vault::new(DataDir::new(data.path()), clock.clone(), KdfParams::TESTING);
        let code = v.initialize(PW).unwrap().display();
        (data, out, clock, v, code)
    }

    #[test]
    fn names_are_lisbon_time() {
        assert_eq!(file_name_for(utc("2026-07-10T21:00:00Z")), "clara-2026-07-10_220000.clarabak");
        assert_eq!(file_name_for(utc("2026-12-10T22:00:00Z")), "clara-2026-12-10_220000.clarabak");
    }

    #[test]
    fn rotation_keeps_7_daily_and_4_weekly() {
        // 60 dias, dois backups por dia.
        let start = NaiveDate::from_ymd_opt(2026, 8, 1).unwrap();
        let mut names = vec![];
        for i in 0..60 {
            let d = start + chrono::Duration::days(i);
            names.push(format!("clara-{}_120000.clarabak", d.format("%Y-%m-%d")));
            names.push(format!("clara-{}_220000.clarabak", d.format("%Y-%m-%d")));
        }
        let keep = select_to_keep(&names);
        // 7 diários (últimos 7 dias, às 22h) + semanas anteriores à mais recente.
        let daily: Vec<_> = keep.iter().filter(|n| n.as_str() >= "clara-2026-09-23").collect();
        assert_eq!(daily.len(), 7);
        assert!(daily.iter().all(|n| n.ends_with("_220000.clarabak")));
        assert!(keep.len() >= 7 && keep.len() <= 7 + 4);
        let weeks: BTreeSet<_> = keep
            .iter()
            .map(|n| {
                let d = parse_file_name(n).unwrap().date();
                (d.iso_week().year(), d.iso_week().week())
            })
            .collect();
        assert!(weeks.len() >= 4);
        // Ficheiros que não são da Clara nunca entram na conta.
        assert!(select_to_keep(&["fotos.zip".into()]).is_empty());
    }

    #[test]
    fn backup_verify_restore_roundtrip() {
        let (data, out, clock, mut v, code) = setup();
        crate::catalog::set_monitoring(v.conn_mut().unwrap(), clock.as_ref(), "idealista-pt", true, None).unwrap();
        let dd = v.data_dir().clone();
        // O evento "backup criado" é gravado depois da cópia, por isso não vai nela.
        let events_at_backup = history::count(v.conn().unwrap()).unwrap();
        let r = backup_from_app(v.conn().unwrap(), &dd, clock.as_ref(), out.path()).unwrap();
        assert!(r.ok, "{:?}", r.error);
        let file = out.path().join(r.file_name.unwrap());

        // O ficheiro de backup não deixa ver o conteúdo.
        let raw = std::fs::read(&file).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("Idealista"));

        // Testar restauro com palavra-passe e com a chave de papel.
        let rep = verify_backup(&dd, &file, SecretKind::Password, PW).unwrap();
        assert!(rep.history_chain_ok);
        assert_eq!(rep.portals, 23);
        verify_backup(&dd, &file, SecretKind::Recovery, &code).unwrap();
        assert!(matches!(verify_backup(&dd, &file, SecretKind::Password, "palavra-passe errada"), Err(ClaraError::WrongSecret)));
        assert_eq!(std::fs::read_dir(dd.tmp()).unwrap().count(), 0);

        // Depois do backup, mais alterações; o restauro volta ao estado do backup.
        crate::catalog::set_monitoring(v.conn_mut().unwrap(), clock.as_ref(), "kyero-pt", true, None).unwrap();
        assert!(matches!(restore(&dd, clock.as_ref(), &file, SecretKind::Password, PW), Err(ClaraError::AlreadyOpen)));
        v.lock();

        // Simula um PC novo: outra pasta de dados vazia, restauro com o papel.
        let new_pc = tempfile::tempdir().unwrap();
        let dd2 = DataDir::new(new_pc.path());
        let res = restore(&dd2, clock.as_ref(), &file, SecretKind::Recovery, &code).unwrap();
        assert!(res.previous_saved_as.is_none());
        let mut v2 = Vault::new(dd2, clock.clone(), KdfParams::TESTING);
        v2.unlock(SecretKind::Password, PW).unwrap();
        let conn = v2.conn().unwrap();
        assert!(crate::catalog::get(conn, "idealista-pt").unwrap().monitoring_enabled);
        assert!(!crate::catalog::get(conn, "kyero-pt").unwrap().monitoring_enabled);
        // estado da cópia + o desbloqueio no PC novo
        assert_eq!(history::count(conn).unwrap(), events_at_backup + 1);
        assert!(history::verify_chain(conn).unwrap().ok);

        // Restaurar por cima de uma base existente guarda a anterior.
        v2.lock();
        let res = restore(&DataDir::new(data.path()), clock.as_ref(), &file, SecretKind::Password, PW).unwrap();
        let prev = std::path::PathBuf::from(res.previous_saved_as.unwrap());
        assert!(prev.join("clara.db").exists() && prev.join("clara.keys").exists());
    }

    #[test]
    fn corrupt_or_truncated_backup_rejected() {
        let (_data, out, clock, v, _) = setup();
        let dd = v.data_dir().clone();
        let r = backup_from_app(v.conn().unwrap(), &dd, clock.as_ref(), out.path()).unwrap();
        let file = out.path().join(r.file_name.unwrap());
        let mut bytes = std::fs::read(&file).unwrap();
        let n = bytes.len();
        bytes[n - 100] ^= 0xff;
        let bad = out.path().join("danificado.clarabak");
        std::fs::write(&bad, &bytes).unwrap();
        assert!(matches!(verify_backup(&dd, &bad, SecretKind::Password, PW), Err(ClaraError::InvalidBackup(_))));
        std::fs::write(&bad, &bytes[..n / 2]).unwrap();
        assert!(matches!(verify_backup(&dd, &bad, SecretKind::Password, PW), Err(ClaraError::InvalidBackup(_))));
        std::fs::write(&bad, b"nada a ver").unwrap();
        assert!(matches!(verify_backup(&dd, &bad, SecretKind::Password, PW), Err(ClaraError::InvalidBackup(_))));
    }

    #[test]
    fn scheduled_backup_respects_open_app_and_imports_runs() {
        let (_data, out, clock, mut v, _) = setup();
        let dd = v.data_dir().clone();
        // App aberta e desbloqueada: a tarefa não mexe.
        assert_eq!(scheduled_backup(&dd, clock.as_ref(), Some(out.path())).unwrap(), ScheduledOutcome::SkippedAppOpen);
        // App bloqueada: a tarefa copia sem a palavra-passe.
        v.lock();
        assert_eq!(scheduled_backup(&dd, clock.as_ref(), Some(out.path())).unwrap(), ScheduledOutcome::Done(true));
        clock.set(utc("2026-10-18T21:00:00Z"));
        assert_eq!(scheduled_backup(&dd, clock.as_ref(), None).unwrap(), ScheduledOutcome::Done(false));
        assert_eq!(list_backups(out.path()).unwrap().len(), 1);
        let st = StatusFile::load(&dd);
        assert!(st.last_success.is_some());
        assert!(!st.last_attempt.unwrap().ok);
        // Ao desbloquear, os resultados entram no histórico, uma só vez.
        v.unlock(SecretKind::Password, PW).unwrap();
        assert_eq!(import_scheduled_runs(v.conn_mut().unwrap(), &dd, clock.as_ref()).unwrap(), 2);
        assert_eq!(import_scheduled_runs(v.conn_mut().unwrap(), &dd, clock.as_ref()).unwrap(), 0);
        assert!(last_success_from_db(v.conn().unwrap()).unwrap().is_some());
        assert!(history::verify_chain(v.conn().unwrap()).unwrap().ok);
    }

    #[test]
    fn missing_folder_reports_failure_without_panicking() {
        let (_data, _out, clock, v, _) = setup();
        let dd = v.data_dir().clone();
        let r = backup_from_app(v.conn().unwrap(), &dd, clock.as_ref(), Path::new("/nao/existe/clara")).unwrap();
        assert!(!r.ok);
        assert!(r.error.unwrap().contains("não existe"));
    }

    #[test]
    fn rotate_only_deletes_clara_files() {
        let (_data, out, clock, v, _) = setup();
        let dd = v.data_dir().clone();
        std::fs::write(out.path().join("outro-ficheiro.txt"), b"x").unwrap();
        for day in 1..=20 {
            clock.set(utc(&format!("2026-09-{day:02}T21:00:00Z")));
            assert!(backup_from_app(v.conn().unwrap(), &dd, clock.as_ref(), out.path()).unwrap().ok);
        }
        let left = list_backups(out.path()).unwrap();
        assert!(left.len() <= KEEP_DAILY + KEEP_WEEKLY && left.len() >= KEEP_DAILY);
        assert!(out.path().join("outro-ficheiro.txt").exists());
    }
}
