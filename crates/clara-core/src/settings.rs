//! Definições guardadas dentro da base cifrada.

use rusqlite::{params, Connection, OptionalExtension};

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};

pub const LOCK_MINUTES_KEY: &str = "lock_minutes";
pub const DEFAULT_LOCK_MINUTES: u32 = 15;
pub const LAST_IMPORTED_RUN_KEY: &str = "last_imported_backup_run";

pub fn get(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn.query_row("SELECT value FROM app_setting WHERE key = ?1", [key], |r| r.get(0)).optional()?)
}

pub fn put(conn: &Connection, clock: &dyn Clock, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_setting (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value, ts(clock.now())],
    )?;
    Ok(())
}

pub fn lock_minutes(conn: &Connection) -> Result<u32> {
    Ok(get(conn, LOCK_MINUTES_KEY)?.and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_LOCK_MINUTES))
}

pub fn set_lock_minutes(conn: &mut Connection, clock: &dyn Clock, minutes: u32) -> Result<u32> {
    if !(1..=120).contains(&minutes) {
        return Err(ClaraError::Invalid("o bloqueio tem de ficar entre 1 e 120 minutos".into()));
    }
    let before = lock_minutes(conn)?;
    if before == minutes {
        return Ok(minutes);
    }
    let tx = conn.transaction()?;
    put(&tx, clock, LOCK_MINUTES_KEY, &minutes.to_string())?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("definicao", Some(LOCK_MINUTES_KEY), "definicao.alterada", format!("Bloqueio por inatividade: {minutes} min"))
            .payload(serde_json::json!({ "antes": before, "depois": minutes })),
    )?;
    tx.commit()?;
    Ok(minutes)
}
