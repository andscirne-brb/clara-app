//! Catálogo dos destinos (portais, site próprio, rede social, categoria).

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Portal {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub monitoring_enabled: bool,
    pub grupo: String,
    pub rules_status: String,
    pub last_verified_at: Option<String>,
    pub updated_at: String,
}

const SELECT: &str = "SELECT id, name, kind, monitoring_enabled, grupo, rules_status, last_verified_at, updated_at FROM portal";

fn row(r: &rusqlite::Row) -> rusqlite::Result<Portal> {
    Ok(Portal {
        id: r.get(0)?,
        name: r.get(1)?,
        kind: r.get(2)?,
        monitoring_enabled: r.get::<_, i64>(3)? == 1,
        grupo: r.get(4)?,
        rules_status: r.get(5)?,
        last_verified_at: r.get(6)?,
        updated_at: r.get(7)?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<Portal>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY sort_order"))?;
    Ok(stmt.query_map([], row)?.collect::<std::result::Result<_, _>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Portal> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row)
        .optional()?
        .ok_or_else(|| ClaraError::NotFound(format!("destino {id}")))
}

pub fn count(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM portal", [], |r| r.get(0))?)
}

/// Liga ou desliga a monitorização de um destino, com evento no histórico.
pub fn set_monitoring(conn: &mut Connection, clock: &dyn Clock, id: &str, enabled: bool, reason: Option<String>) -> Result<Portal> {
    let tx = conn.transaction()?;
    let before = get(&tx, id)?;
    if before.monitoring_enabled == enabled {
        return Ok(before);
    }
    tx.execute(
        "UPDATE portal SET monitoring_enabled = ?1, updated_at = ?2 WHERE id = ?3",
        params![enabled as i64, ts(clock.now()), id],
    )?;
    let verb = if enabled { "ativada" } else { "desativada" };
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("portal", Some(id), "portal.monitorizacao", format!("Monitorização {verb}: {}", before.name))
            .reason(reason)
            .payload(serde_json::json!({ "antes": before.monitoring_enabled, "depois": enabled })),
    )?;
    let after = get(&tx, id)?;
    tx.commit()?;
    Ok(after)
}
