//! Comandos chamados pela interface. Cada um faz uma coisa concreta; a
//! interface nunca recebe acesso genérico a SQL, ficheiros ou shell.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use clara_core::backup::{self, BackupFile, RunRecord, StatusFile, VerifyReport};
use clara_core::catalog::{self, Portal};
use clara_core::config::Config;
use clara_core::history::{self, ChainReport, HistoryEvent};
use clara_core::keys::SecretKind;
use clara_core::{schedule, settings, ClaraError, TZ};

use crate::task::{self, TaskStatus};
use crate::AppState;

type Res<T> = Result<T, String>;

fn e(err: ClaraError) -> String {
    err.to_string()
}

#[derive(Serialize)]
pub struct AppStatus {
    initialized: bool,
    unlocked: bool,
    lock_minutes: u32,
    data_dir: String,
    version: &'static str,
    pending_restore: bool,
}

#[tauri::command]
pub async fn app_status(state: State<'_, AppState>) -> Res<AppStatus> {
    let v = state.vault.lock().unwrap();
    Ok(AppStatus {
        initialized: v.is_initialized(),
        unlocked: v.is_unlocked(),
        lock_minutes: state.lock_minutes.load(Ordering::Relaxed),
        data_dir: v.data_dir().root().to_string_lossy().to_string(),
        version: env!("CARGO_PKG_VERSION"),
        pending_restore: state.pending_restore.lock().unwrap().is_some(),
    })
}

#[tauri::command]
pub async fn touch(state: State<'_, AppState>) -> Res<()> {
    state.touch();
    Ok(())
}

/// Depois de abrir: lê o tempo de bloqueio, importa os backups da tarefa e
/// regista um restauro pendente.
fn after_unlock(state: &AppState) -> Res<()> {
    let mut v = state.vault.lock().unwrap();
    let dd = v.data_dir().clone();
    let clock = v.clock_arc();
    let minutes = settings::lock_minutes(v.conn().map_err(e)?).map_err(e)?;
    state.lock_minutes.store(minutes, Ordering::Relaxed);
    backup::import_scheduled_runs(v.conn_mut().map_err(e)?, &dd, clock.as_ref()).map_err(e)?;
    if let Some(r) = state.pending_restore.lock().unwrap().take() {
        backup::record_restore(v.conn().map_err(e)?, clock.as_ref(), &r).map_err(e)?;
    }
    state.touch();
    Ok(())
}

#[derive(Serialize)]
pub struct RecoveryOut {
    groups: Vec<String>,
}

#[tauri::command]
pub async fn create_vault(state: State<'_, AppState>, password: String) -> Res<RecoveryOut> {
    let code = state.vault.lock().unwrap().initialize(&password).map_err(e)?;
    after_unlock(&state)?;
    Ok(RecoveryOut { groups: code.groups() })
}

fn kind(k: &str) -> Res<SecretKind> {
    match k {
        "password" => Ok(SecretKind::Password),
        "recovery" => Ok(SecretKind::Recovery),
        _ => Err("Tipo de segredo desconhecido.".into()),
    }
}

#[tauri::command]
pub async fn unlock(state: State<'_, AppState>, secret_kind: String, secret: String) -> Res<()> {
    let k = kind(&secret_kind)?;
    let result = state.vault.lock().unwrap().unlock(k, &secret);
    if let Err(err) = result {
        // Atraso fixo depois de uma tentativa errada.
        if matches!(err, ClaraError::WrongSecret | ClaraError::InvalidRecoveryCode) {
            std::thread::sleep(std::time::Duration::from_millis(800));
        }
        return Err(e(err));
    }
    after_unlock(&state)
}

#[tauri::command]
pub async fn lock(state: State<'_, AppState>) -> Res<()> {
    state.vault.lock().unwrap().lock();
    Ok(())
}

#[tauri::command]
pub async fn reset_password(state: State<'_, AppState>, recovery: String, new_password: String) -> Res<()> {
    state.vault.lock().unwrap().reset_password_with_recovery(&recovery, &new_password).map_err(e)?;
    after_unlock(&state)
}

#[tauri::command]
pub async fn change_password(state: State<'_, AppState>, current: String, new_password: String) -> Res<()> {
    state.touch();
    state.vault.lock().unwrap().change_password(&current, &new_password).map_err(e)
}

#[tauri::command]
pub async fn regenerate_recovery(state: State<'_, AppState>, password: String) -> Res<RecoveryOut> {
    state.touch();
    let code = state.vault.lock().unwrap().regenerate_recovery(&password).map_err(e)?;
    Ok(RecoveryOut { groups: code.groups() })
}

#[tauri::command]
pub async fn set_lock_minutes(state: State<'_, AppState>, minutes: u32) -> Res<u32> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let m = settings::set_lock_minutes(v.conn_mut().map_err(e)?, clock.as_ref(), minutes).map_err(e)?;
    state.lock_minutes.store(m, Ordering::Relaxed);
    Ok(m)
}

#[tauri::command]
pub async fn portals_list(state: State<'_, AppState>) -> Res<Vec<Portal>> {
    let v = state.vault.lock().unwrap();
    catalog::list(v.conn().map_err(e)?).map_err(e)
}

#[tauri::command]
pub async fn portal_set_monitoring(state: State<'_, AppState>, id: String, enabled: bool) -> Res<Portal> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    catalog::set_monitoring(v.conn_mut().map_err(e)?, clock.as_ref(), &id, enabled, None).map_err(e)
}

#[derive(Serialize)]
pub struct HistoryPage {
    events: Vec<HistoryEvent>,
    total: i64,
}

#[tauri::command]
pub async fn history_list(state: State<'_, AppState>, limit: i64, offset: i64) -> Res<HistoryPage> {
    let v = state.vault.lock().unwrap();
    let conn = v.conn().map_err(e)?;
    Ok(HistoryPage {
        events: history::list(conn, limit.clamp(1, 500), offset.max(0)).map_err(e)?,
        total: history::count(conn).map_err(e)?,
    })
}

#[tauri::command]
pub async fn history_verify(state: State<'_, AppState>) -> Res<ChainReport> {
    state.touch();
    let v = state.vault.lock().unwrap();
    history::verify_chain(v.conn().map_err(e)?).map_err(e)
}

#[derive(Serialize)]
pub struct BackupOverview {
    dir: Option<String>,
    dir_confirmed: bool,
    dir_problem: Option<String>,
    last_success: Option<RunRecord>,
    last_attempt: Option<RunRecord>,
    stale: bool,
    next_slot_local: String,
    files: Vec<BackupFile>,
    task: TaskStatus,
    picked_file: Option<String>,
}

fn next_slot_local() -> String {
    // O último horário das 22h antes de "agora + 25 h" é sempre o próximo.
    let next = schedule::last_slot(chrono::Utc::now() + chrono::Duration::hours(25));
    next.with_timezone(&TZ).format("%d/%m/%Y às %H:%M").to_string()
}

#[tauri::command]
pub async fn backup_overview(state: State<'_, AppState>) -> Res<BackupOverview> {
    let dd = state.dd();
    let cfg = Config::load(&dd).map_err(e)?;
    let status = StatusFile::load(&dd);
    let (files, dir_problem) = match &cfg.backup_dir {
        Some(d) if Path::new(d).is_dir() => (backup::list_backups(Path::new(d)).unwrap_or_default(), None),
        Some(d) => (vec![], Some(format!("A pasta {d} não está acessível. O Google Drive está aberto?"))),
        None => (vec![], None),
    };
    Ok(BackupOverview {
        stale: schedule::is_stale(chrono::Utc::now(), status.last_success_at()),
        dir: cfg.backup_dir,
        dir_confirmed: cfg.backup_dir_confirmed,
        dir_problem,
        last_success: status.last_success,
        last_attempt: status.last_attempt,
        next_slot_local: next_slot_local(),
        files,
        task: task::status(),
        picked_file: state.picked_file.lock().unwrap().as_ref().map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub async fn backup_pick_dir(app: AppHandle, state: State<'_, AppState>) -> Res<Option<String>> {
    state.touch();
    let Some(picked) = app.dialog().file().set_title("Escolhe a pasta Clara Backups").blocking_pick_folder() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|err| err.to_string())?;
    let dd = state.dd();
    if path.starts_with(dd.root()) {
        return Err("A pasta de backup não pode ficar dentro da pasta de dados da Clara.".into());
    }
    let mut cfg = Config::load(&dd).map_err(e)?;
    cfg.backup_dir = Some(path.to_string_lossy().to_string());
    cfg.backup_dir_confirmed = false;
    cfg.save(&dd).map_err(e)?;
    Ok(cfg.backup_dir)
}

#[tauri::command]
pub async fn backup_confirm_dir(state: State<'_, AppState>, confirmed: bool) -> Res<()> {
    state.touch();
    let dd = state.dd();
    let mut cfg = Config::load(&dd).map_err(e)?;
    cfg.backup_dir_confirmed = confirmed && cfg.backup_dir.is_some();
    cfg.save(&dd).map_err(e)
}

#[tauri::command]
pub async fn backup_now(state: State<'_, AppState>) -> Res<RunRecord> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let dd = v.data_dir().clone();
    let dir = Config::load(&dd).map_err(e)?.backup_dir.ok_or_else(|| e(ClaraError::NoBackupDir))?;
    backup::backup_from_app(v.conn().map_err(e)?, &dd, v.clock(), Path::new(&dir)).map_err(e)
}

#[tauri::command]
pub async fn backup_pick_file(app: AppHandle, state: State<'_, AppState>) -> Res<Option<String>> {
    state.touch();
    let picked = app
        .dialog()
        .file()
        .set_title("Escolhe um backup da Clara")
        .add_filter("Backup da Clara", &[backup::EXTENSION])
        .blocking_pick_file();
    let path = match picked {
        Some(p) => Some(p.into_path().map_err(|err| err.to_string())?),
        None => None,
    };
    *state.picked_file.lock().unwrap() = path.clone();
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

/// Só aceita um ficheiro escolhido no diálogo ou um nome da lista da pasta de backup.
fn resolve_backup(state: &AppState, file_name: Option<String>) -> Res<PathBuf> {
    match file_name {
        Some(name) => {
            if name.contains(['/', '\\']) || !name.ends_with(&format!(".{}", backup::EXTENSION)) {
                return Err("Nome de ficheiro inválido.".into());
            }
            let dir = Config::load(&state.dd()).map_err(e)?.backup_dir.ok_or_else(|| e(ClaraError::NoBackupDir))?;
            Ok(Path::new(&dir).join(name))
        }
        None => state.picked_file.lock().unwrap().clone().ok_or_else(|| "Escolhe primeiro um ficheiro de backup.".into()),
    }
}

#[tauri::command]
pub async fn backup_verify(state: State<'_, AppState>, file_name: Option<String>, secret_kind: String, secret: String) -> Res<VerifyReport> {
    state.touch();
    let path = resolve_backup(&state, file_name)?;
    let dd = state.dd();
    let report = backup::verify_backup(&dd, &path, kind(&secret_kind)?, &secret).map_err(e)?;
    let v = state.vault.lock().unwrap();
    if let Ok(conn) = v.conn() {
        backup::record_verification(conn, v.clock(), &report).map_err(e)?;
    }
    Ok(report)
}

#[derive(Serialize)]
pub struct RestoreOut {
    report: VerifyReport,
    previous_saved_as: Option<String>,
}

/// Restaura e deixa a Clara bloqueada; o restauro fica registado no próximo desbloqueio.
#[tauri::command]
pub async fn backup_restore(state: State<'_, AppState>, file_name: Option<String>, secret_kind: String, secret: String) -> Res<RestoreOut> {
    let path = resolve_backup(&state, file_name)?;
    let mut v = state.vault.lock().unwrap();
    v.lock();
    let dd = v.data_dir().clone();
    let r = backup::restore(&dd, v.clock(), &path, kind(&secret_kind)?, &secret).map_err(e)?;
    let out = RestoreOut { report: r.report.clone(), previous_saved_as: r.previous_saved_as.clone() };
    *state.pending_restore.lock().unwrap() = Some(r);
    Ok(out)
}

#[tauri::command]
pub async fn task_install(state: State<'_, AppState>) -> Res<TaskStatus> {
    state.touch();
    task::install(&state.dd())?;
    Ok(task::status())
}

#[tauri::command]
pub async fn task_run_now(state: State<'_, AppState>) -> Res<()> {
    state.touch();
    task::run_now()
}

#[tauri::command]
pub async fn task_remove(state: State<'_, AppState>) -> Res<TaskStatus> {
    state.touch();
    task::remove()?;
    Ok(task::status())
}
