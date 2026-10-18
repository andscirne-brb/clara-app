//! Abertura da base SQLCipher.

use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use zeroize::Zeroizing;

use crate::error::{ClaraError, Result};
use crate::keys::MasterKey;

fn apply_key(conn: &Connection, key: &MasterKey) -> Result<()> {
    // Chave em bruto: PRAGMA key = "x'...'" (aspas duplas, como indica o SQLCipher).
    let stmt = Zeroizing::new(format!("PRAGMA key = \"{}\";", key.sqlcipher_pragma_value().as_str()));
    conn.execute_batch(&stmt)?;
    // Só aqui se percebe se a chave está certa.
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0))
        .map_err(|_| ClaraError::WrongSecret)?;
    Ok(())
}

fn harden(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode = DELETE;
         PRAGMA foreign_keys = ON;
         PRAGMA secure_delete = ON;
         PRAGMA temp_store = MEMORY;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(())
}

/// Abre (ou cria) a base cifrada para leitura e escrita.
pub fn open(path: &Path, key: &MasterKey) -> Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    apply_key(&conn, key)?;
    harden(&conn)?;
    Ok(conn)
}

/// Abre só para leitura (verificação de backups).
pub fn open_read_only(path: &Path, key: &MasterKey) -> Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    apply_key(&conn, key)?;
    conn.execute_batch("PRAGMA temp_store = MEMORY;")?;
    Ok(conn)
}

/// Verificações do SQLCipher (HMAC de cada página) e do SQLite.
pub fn integrity(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA cipher_integrity_check")?;
    let problems: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<_, _>>()?;
    if !problems.is_empty() {
        return Err(ClaraError::Integrity(format!("cifragem: {}", problems.join("; "))));
    }
    let ok: String = conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if ok != "ok" {
        return Err(ClaraError::Integrity(format!("estrutura: {ok}")));
    }
    Ok(())
}

pub fn cipher_version(conn: &Connection) -> Result<String> {
    Ok(conn.query_row("PRAGMA cipher_version", [], |r| r.get(0))?)
}
