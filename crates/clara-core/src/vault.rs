//! O cofre: abre, bloqueia e dá acesso à base cifrada.
//!
//! Enquanto o cofre está desbloqueado, a Clara guarda um bloqueio exclusivo
//! no ficheiro `clara.lock`. A tarefa agendada usa esse ficheiro para saber
//! se pode copiar a base sem a abrir.

use rusqlite::Connection;
use std::fs::{File, OpenOptions};
use std::sync::Arc;

use crate::clock::Clock;
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};
use crate::keys::{KdfParams, KeyFile, MasterKey, SecretKind};
use crate::paths::{write_atomic, DataDir};
use crate::recovery::RecoveryCode;
use crate::{db, migrations};

/// Bloqueio exclusivo do ficheiro `clara.lock` (libertado ao sair de âmbito).
pub struct ProcessLock(#[allow(dead_code)] File);

impl ProcessLock {
    pub fn try_acquire(dd: &DataDir) -> Result<Option<ProcessLock>> {
        dd.ensure()?;
        let f = OpenOptions::new().create(true).truncate(false).read(true).write(true).open(dd.lock())?;
        match f.try_lock() {
            Ok(()) => Ok(Some(ProcessLock(f))),
            Err(std::fs::TryLockError::WouldBlock) => Ok(None),
            Err(std::fs::TryLockError::Error(e)) => Err(e.into()),
        }
    }
}

struct Open {
    conn: Connection,
    _lock: ProcessLock,
}

pub struct Vault {
    dd: DataDir,
    clock: Arc<dyn Clock>,
    kdf: KdfParams,
    open: Option<Open>,
}

impl Vault {
    pub fn new(dd: DataDir, clock: Arc<dyn Clock>, kdf: KdfParams) -> Self {
        Self { dd, clock, kdf, open: None }
    }

    pub fn data_dir(&self) -> &DataDir {
        &self.dd
    }
    pub fn clock(&self) -> &dyn Clock {
        self.clock.as_ref()
    }
    pub fn clock_arc(&self) -> Arc<dyn Clock> {
        self.clock.clone()
    }
    pub fn is_initialized(&self) -> bool {
        self.dd.is_initialized()
    }
    pub fn is_unlocked(&self) -> bool {
        self.open.is_some()
    }

    fn read_keyfile(&self) -> Result<KeyFile> {
        let s = std::fs::read_to_string(self.dd.keys()).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => ClaraError::NotInitialized,
            _ => e.into(),
        })?;
        KeyFile::from_json(&s)
    }

    fn write_keyfile(&self, kf: &KeyFile) -> Result<()> {
        write_atomic(&self.dd.keys(), kf.to_json()?.as_bytes())?;
        Ok(())
    }

    fn acquire_lock(&self) -> Result<ProcessLock> {
        ProcessLock::try_acquire(&self.dd)?.ok_or(ClaraError::AlreadyOpen)
    }

    /// Primeira configuração: cria chaves e base. Devolve o código para o papel.
    pub fn initialize(&mut self, password: &str) -> Result<RecoveryCode> {
        if self.dd.db().exists() || self.dd.keys().exists() {
            return Err(ClaraError::AlreadyInitialized);
        }
        self.dd.ensure()?;
        let lock = self.acquire_lock()?;
        let (kf, master, code) = KeyFile::create(password, self.kdf)?;
        let mut conn = db::open(&self.dd.db(), &master)?;
        migrations::migrate(&mut conn, self.clock())?;
        history::record(
            &conn,
            self.clock(),
            Actor::Andreia,
            NewEvent::new("cofre", None, "cofre.criado", "Clara configurada: base cifrada criada"),
        )?;
        self.write_keyfile(&kf)?;
        self.open = Some(Open { conn, _lock: lock });
        Ok(code)
    }

    fn open_with(&mut self, master: &MasterKey) -> Result<()> {
        let lock = self.acquire_lock()?;
        self.dd.clean_tmp();
        let mut conn = db::open(&self.dd.db(), master)?;
        migrations::migrate(&mut conn, self.clock())?;
        self.open = Some(Open { conn, _lock: lock });
        Ok(())
    }

    pub fn unlock(&mut self, kind: SecretKind, secret: &str) -> Result<()> {
        if self.open.is_some() {
            return Ok(());
        }
        let kf = self.read_keyfile()?;
        let master = kf.unlock(kind, secret)?;
        self.open_with(&master)?;
        let how = match kind {
            SecretKind::Password => "palavra-passe",
            SecretKind::Recovery => "chave de recuperação",
        };
        history::record(
            self.conn()?,
            self.clock(),
            Actor::Andreia,
            NewEvent::new("cofre", None, "cofre.desbloqueado", format!("Clara desbloqueada com {how}")),
        )?;
        Ok(())
    }

    /// Fecha a base e apaga a chave da memória.
    pub fn lock(&mut self) {
        if let Some(open) = self.open.take() {
            let _ = open.conn.close();
        }
    }

    pub fn conn(&self) -> Result<&Connection> {
        self.open.as_ref().map(|o| &o.conn).ok_or(ClaraError::Locked)
    }

    pub fn conn_mut(&mut self) -> Result<&mut Connection> {
        self.open.as_mut().map(|o| &mut o.conn).ok_or(ClaraError::Locked)
    }

    pub fn change_password(&mut self, current: &str, new_password: &str) -> Result<()> {
        self.conn()?;
        let mut kf = self.read_keyfile()?;
        kf.change_password(current, new_password)?;
        self.write_keyfile(&kf)?;
        history::record(self.conn()?, self.clock(), Actor::Andreia, NewEvent::new("cofre", None, "cofre.palavra_passe_alterada", "Palavra-passe alterada"))?;
        Ok(())
    }

    pub fn regenerate_recovery(&mut self, password: &str) -> Result<RecoveryCode> {
        self.conn()?;
        let mut kf = self.read_keyfile()?;
        let code = kf.regenerate_recovery(password)?;
        self.write_keyfile(&kf)?;
        history::record(
            self.conn()?,
            self.clock(),
            Actor::Andreia,
            NewEvent::new("cofre", None, "cofre.recuperacao_regenerada", "Nova chave de recuperação gerada; a anterior deixou de abrir esta base"),
        )?;
        Ok(code)
    }

    /// Palavra-passe esquecida: desbloqueia com a chave de papel e define outra.
    pub fn reset_password_with_recovery(&mut self, code: &str, new_password: &str) -> Result<()> {
        let mut kf = self.read_keyfile()?;
        kf.reset_password_with_recovery(code, new_password)?;
        let master = kf.unlock(SecretKind::Password, new_password)?;
        self.write_keyfile(&kf)?;
        if self.open.is_none() {
            self.open_with(&master)?;
        }
        history::record(
            self.conn()?,
            self.clock(),
            Actor::Andreia,
            NewEvent::new("cofre", None, "cofre.palavra_passe_reposta", "Palavra-passe reposta com a chave de recuperação"),
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SystemClock;
    use crate::keys::KdfParams;

    const PW: &str = "frase de teste comprida";

    fn vault(dir: &std::path::Path) -> Vault {
        Vault::new(DataDir::new(dir), Arc::new(SystemClock), KdfParams::TESTING)
    }

    #[test]
    fn initialize_lock_unlock() {
        let t = tempfile::tempdir().unwrap();
        let mut v = vault(t.path());
        let code = v.initialize(PW).unwrap();
        assert!(v.is_unlocked());
        v.lock();
        assert!(matches!(v.conn(), Err(ClaraError::Locked)));
        assert!(matches!(v.unlock(SecretKind::Password, "frase errada qualquer"), Err(ClaraError::WrongSecret)));
        v.unlock(SecretKind::Password, PW).unwrap();
        v.lock();
        v.unlock(SecretKind::Recovery, &code.display()).unwrap();
        assert_eq!(crate::catalog::count(v.conn().unwrap()).unwrap(), 23);
    }

    #[test]
    fn db_file_is_not_plain_sqlite() {
        let t = tempfile::tempdir().unwrap();
        let mut v = vault(t.path());
        v.initialize(PW).unwrap();
        v.lock();
        let bytes = std::fs::read(t.path().join("clara.db")).unwrap();
        assert!(!bytes.starts_with(b"SQLite format 3"));
        let plain = rusqlite::Connection::open(t.path().join("clara.db")).unwrap();
        assert!(plain.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)).is_err());
        let text = String::from_utf8_lossy(&bytes);
        assert!(!text.contains("Idealista"));
    }

    #[test]
    fn cannot_initialize_twice() {
        let t = tempfile::tempdir().unwrap();
        let mut v = vault(t.path());
        v.initialize(PW).unwrap();
        v.lock();
        assert!(matches!(vault(t.path()).initialize(PW), Err(ClaraError::AlreadyInitialized)));
    }

    #[test]
    fn second_instance_is_refused_while_open() {
        let t = tempfile::tempdir().unwrap();
        let mut a = vault(t.path());
        a.initialize(PW).unwrap();
        let mut b = vault(t.path());
        assert!(matches!(b.unlock(SecretKind::Password, PW), Err(ClaraError::AlreadyOpen)));
        a.lock();
        b.unlock(SecretKind::Password, PW).unwrap();
    }

    #[test]
    fn password_reset_with_recovery() {
        let t = tempfile::tempdir().unwrap();
        let mut v = vault(t.path());
        let code = v.initialize(PW).unwrap();
        v.lock();
        v.reset_password_with_recovery(&code.display(), "outra frase comprida").unwrap();
        assert!(v.is_unlocked());
        v.lock();
        v.unlock(SecretKind::Password, "outra frase comprida").unwrap();
    }
}
