//! Migrações versionadas, aplicadas em transação. Cada migração aplicada
//! fica registada no histórico.

use rusqlite::{params, Connection, OptionalExtension};

use crate::clock::{ts, Clock};
use crate::error::Result;
use crate::history::{self, Actor, NewEvent};

pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration { version: 1, name: "base", sql: include_str!("../migrations/001_base.sql") },
    Migration { version: 2, name: "catalogo", sql: include_str!("../migrations/002_catalogo.sql") },
    Migration { version: 3, name: "ciclo", sql: include_str!("../migrations/003_ciclo.sql") },
    Migration { version: 4, name: "recolha", sql: include_str!("../migrations/004_recolha.sql") },
    Migration { version: 5, name: "resumos", sql: include_str!("../migrations/005_resumos.sql") },
    Migration { version: 6, name: "destinos_feed", sql: include_str!("../migrations/006_destinos_feed.sql") },
];

pub fn latest_version() -> i64 {
    MIGRATIONS.last().map(|m| m.version).unwrap_or(0)
}

pub fn current_version(conn: &Connection) -> Result<i64> {
    let has: Option<String> = conn
        .query_row("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migration'", [], |r| r.get(0))
        .optional()?;
    if has.is_none() {
        return Ok(0);
    }
    Ok(conn.query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migration", [], |r| r.get(0))?)
}

/// Aplica as migrações em falta. Pode correr várias vezes sem efeito adicional.
pub fn migrate(conn: &mut Connection, clock: &dyn Clock) -> Result<Vec<i64>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migration (
           version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
    )?;
    let current = current_version(conn)?;
    let mut applied = vec![];
    for m in MIGRATIONS.iter().filter(|m| m.version > current) {
        let tx = conn.transaction()?;
        tx.execute_batch(m.sql)?;
        tx.execute(
            "INSERT INTO schema_migration (version, name, applied_at) VALUES (?1, ?2, ?3)",
            params![m.version, m.name, ts(clock.now())],
        )?;
        history::record(
            &tx,
            clock,
            Actor::Sistema,
            NewEvent::new("schema", Some(&m.version.to_string()), "migracao.aplicada", format!("Migração {:03} ({}) aplicada", m.version, m.name)),
        )?;
        tx.commit()?;
        applied.push(m.version);
    }
    Ok(applied)
}
