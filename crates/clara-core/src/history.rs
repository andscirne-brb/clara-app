//! Histórico append-only com encadeamento de hashes.
//!
//! Cada alteração de domínio grava o seu evento na mesma transação. Os
//! eventos não podem ser editados nem apagados (triggers na base). Uma
//! correção é um evento novo que compensa o anterior. O conteúdo antes/depois
//! fica em `history_payload`, separado, e só pode ser expurgado depois de um
//! evento de redação, sem partir a cadeia.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};

pub const GENESIS: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Actor {
    Andreia,
    Sistema,
}

impl Actor {
    fn as_str(self) -> &'static str {
        match self {
            Actor::Andreia => "andreia",
            Actor::Sistema => "sistema",
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct NewEvent {
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub action: String,
    pub origin: String,
    pub reason: Option<String>,
    pub summary: String,
    pub correlation_id: Option<String>,
    pub compensates_event_id: Option<String>,
    /// Antes/depois estritamente necessário (JSON). Fica em tabela separada.
    pub payload: Option<serde_json::Value>,
}

impl NewEvent {
    pub fn new(entity_type: &str, entity_id: Option<&str>, action: &str, summary: impl Into<String>) -> Self {
        Self {
            entity_type: entity_type.into(),
            entity_id: entity_id.map(str::to_string),
            action: action.into(),
            origin: "clara".into(),
            summary: summary.into(),
            ..Default::default()
        }
    }
    pub fn reason(mut self, r: Option<String>) -> Self {
        self.reason = r.filter(|s| !s.trim().is_empty());
        self
    }
    pub fn payload(mut self, p: serde_json::Value) -> Self {
        self.payload = Some(p);
        self
    }
    pub fn origin(mut self, o: &str) -> Self {
        self.origin = o.into();
        self
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct HistoryEvent {
    pub seq: i64,
    pub id: String,
    pub occurred_at: String,
    pub actor: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub action: String,
    pub origin: String,
    pub reason: Option<String>,
    pub summary: String,
    pub correlation_id: Option<String>,
    pub compensates_event_id: Option<String>,
    pub has_payload: bool,
    pub redacted: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ChainReport {
    pub events: i64,
    pub ok: bool,
    pub problem: Option<String>,
}

fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

struct Fields<'a> {
    id: &'a str,
    occurred_at: &'a str,
    actor: &'a str,
    entity_type: &'a str,
    entity_id: Option<&'a str>,
    action: &'a str,
    origin: &'a str,
    reason: Option<&'a str>,
    summary: &'a str,
    correlation_id: Option<&'a str>,
    compensates: Option<&'a str>,
    payload_sha256: Option<&'a str>,
    prev_hash: &'a str,
}

fn event_hash(f: &Fields) -> String {
    // Serialização canónica: JSON com ordem fixa de campos.
    let canonical = serde_json::json!([
        "clara/history/v1",
        f.id,
        f.occurred_at,
        f.actor,
        f.entity_type,
        f.entity_id,
        f.action,
        f.origin,
        f.reason,
        f.summary,
        f.correlation_id,
        f.compensates,
        f.payload_sha256,
        f.prev_hash
    ]);
    sha256_hex(canonical.to_string().as_bytes())
}

pub(crate) fn map_immutable(e: rusqlite::Error) -> ClaraError {
    if e.to_string().contains("history_immutable") {
        ClaraError::HistoryImmutable
    } else {
        ClaraError::Db(e)
    }
}

/// Grava um evento. Chamar dentro da mesma transação da alteração de domínio.
pub fn record(conn: &Connection, clock: &dyn Clock, actor: Actor, ev: NewEvent) -> Result<String> {
    let id = uuid::Uuid::new_v4().to_string();
    let occurred_at = ts(clock.now());
    let prev_hash: String = conn
        .query_row("SELECT hash FROM history_event ORDER BY seq DESC LIMIT 1", [], |r| r.get(0))
        .optional()?
        .unwrap_or_else(|| GENESIS.to_string());
    let payload_text = ev.payload.as_ref().map(|p| p.to_string());
    let payload_sha = payload_text.as_ref().map(|t| sha256_hex(t.as_bytes()));
    let hash = event_hash(&Fields {
        id: &id,
        occurred_at: &occurred_at,
        actor: actor.as_str(),
        entity_type: &ev.entity_type,
        entity_id: ev.entity_id.as_deref(),
        action: &ev.action,
        origin: &ev.origin,
        reason: ev.reason.as_deref(),
        summary: &ev.summary,
        correlation_id: ev.correlation_id.as_deref(),
        compensates: ev.compensates_event_id.as_deref(),
        payload_sha256: payload_sha.as_deref(),
        prev_hash: &prev_hash,
    });
    conn.execute(
        "INSERT INTO history_event (id, occurred_at, actor, entity_type, entity_id, action, origin, reason,
           summary, correlation_id, compensates_event_id, payload_sha256, prev_hash, hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            id,
            occurred_at,
            actor.as_str(),
            ev.entity_type,
            ev.entity_id,
            ev.action,
            ev.origin,
            ev.reason,
            ev.summary,
            ev.correlation_id,
            ev.compensates_event_id,
            payload_sha,
            prev_hash,
            hash
        ],
    )?;
    if let Some(t) = payload_text {
        conn.execute("INSERT INTO history_payload (event_id, content) VALUES (?1, ?2)", params![id, t])?;
    }
    Ok(id)
}

/// Correção: novo evento que referencia o original, que fica intacto.
pub fn compensate(conn: &Connection, clock: &dyn Clock, original_id: &str, reason: &str, summary: &str) -> Result<String> {
    let exists: Option<String> = conn
        .query_row("SELECT entity_type FROM history_event WHERE id = ?1", [original_id], |r| r.get(0))
        .optional()?;
    let entity_type = exists.ok_or_else(|| ClaraError::NotFound("evento".into()))?;
    let mut ev = NewEvent::new(&entity_type, None, "historico.compensacao", summary).reason(Some(reason.into()));
    ev.compensates_event_id = Some(original_id.into());
    record(conn, clock, Actor::Andreia, ev)
}

/// Expurgo autorizado do conteúdo sensível de um evento. O evento e a cadeia ficam.
pub fn redact_payload(conn: &Connection, clock: &dyn Clock, event_id: &str, reason: &str) -> Result<()> {
    if reason.trim().is_empty() {
        return Err(ClaraError::Invalid("a redação exige motivo".into()));
    }
    let n: i64 = conn.query_row("SELECT count(*) FROM history_payload WHERE event_id = ?1", [event_id], |r| r.get(0))?;
    if n == 0 {
        return Err(ClaraError::NotFound("conteúdo do evento".into()));
    }
    record(
        conn,
        clock,
        Actor::Andreia,
        NewEvent::new("history_event", Some(event_id), "historico.redacao", "Conteúdo de evento expurgado")
            .reason(Some(reason.into())),
    )?;
    conn.execute("DELETE FROM history_payload WHERE event_id = ?1", [event_id]).map_err(map_immutable)?;
    Ok(())
}

pub fn list(conn: &Connection, limit: i64, offset: i64) -> Result<Vec<HistoryEvent>> {
    let mut stmt = conn.prepare(
        "SELECT e.seq, e.id, e.occurred_at, e.actor, e.entity_type, e.entity_id, e.action, e.origin, e.reason,
                e.summary, e.correlation_id, e.compensates_event_id,
                e.payload_sha256 IS NOT NULL, p.event_id IS NULL AND e.payload_sha256 IS NOT NULL
         FROM history_event e LEFT JOIN history_payload p ON p.event_id = e.id
         ORDER BY e.seq DESC LIMIT ?1 OFFSET ?2",
    )?;
    let rows = stmt.query_map(params![limit, offset], |r| {
        Ok(HistoryEvent {
            seq: r.get(0)?,
            id: r.get(1)?,
            occurred_at: r.get(2)?,
            actor: r.get(3)?,
            entity_type: r.get(4)?,
            entity_id: r.get(5)?,
            action: r.get(6)?,
            origin: r.get(7)?,
            reason: r.get(8)?,
            summary: r.get(9)?,
            correlation_id: r.get(10)?,
            compensates_event_id: r.get(11)?,
            has_payload: r.get(12)?,
            redacted: r.get(13)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

pub fn count(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM history_event", [], |r| r.get(0))?)
}

/// Recalcula a cadeia inteira e confere os conteúdos que ainda existem.
pub fn verify_chain(conn: &Connection) -> Result<ChainReport> {
    let mut stmt = conn.prepare(
        "SELECT e.seq, e.id, e.occurred_at, e.actor, e.entity_type, e.entity_id, e.action, e.origin, e.reason,
                e.summary, e.correlation_id, e.compensates_event_id, e.payload_sha256, e.prev_hash, e.hash, p.content
         FROM history_event e LEFT JOIN history_payload p ON p.event_id = e.id ORDER BY e.seq",
    )?;
    let mut rows = stmt.query([])?;
    let mut expected_prev = GENESIS.to_string();
    let mut n = 0i64;
    while let Some(r) = rows.next()? {
        n += 1;
        let seq: i64 = r.get(0)?;
        let get = |i| r.get::<_, Option<String>>(i);
        let (id, at, actor, et, eid, act, ori, rea, sum, cor, comp, psha, prev, hash, content): (
            String,
            String,
            String,
            String,
            Option<String>,
            String,
            String,
            Option<String>,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
            String,
            Option<String>,
        ) = (
            r.get(1)?,
            r.get(2)?,
            r.get(3)?,
            r.get(4)?,
            get(5)?,
            r.get(6)?,
            r.get(7)?,
            get(8)?,
            r.get(9)?,
            get(10)?,
            get(11)?,
            get(12)?,
            r.get(13)?,
            r.get(14)?,
            get(15)?,
        );
        let fail = |m: &str| Ok(ChainReport { events: n, ok: false, problem: Some(format!("evento n.º {seq}: {m}")) });
        if prev != expected_prev {
            return fail("ligação ao evento anterior quebrada");
        }
        let recomputed = event_hash(&Fields {
            id: &id,
            occurred_at: &at,
            actor: &actor,
            entity_type: &et,
            entity_id: eid.as_deref(),
            action: &act,
            origin: &ori,
            reason: rea.as_deref(),
            summary: &sum,
            correlation_id: cor.as_deref(),
            compensates: comp.as_deref(),
            payload_sha256: psha.as_deref(),
            prev_hash: &prev,
        });
        if recomputed != hash {
            return fail("conteúdo alterado");
        }
        if let (Some(c), Some(h)) = (&content, &psha) {
            if &sha256_hex(c.as_bytes()) != h {
                return fail("conteúdo antes/depois alterado");
            }
        }
        if content.is_some() && psha.is_none() {
            return fail("conteúdo antes/depois acrescentado");
        }
        expected_prev = hash;
    }
    Ok(ChainReport { events: n, ok: true, problem: None })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SystemClock;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        crate::migrations::migrate(&mut c, &SystemClock).unwrap();
        c
    }

    #[test]
    fn events_cannot_be_updated_or_deleted() {
        let c = conn();
        let id = record(&c, &SystemClock, Actor::Andreia, NewEvent::new("t", None, "t.a", "um")).unwrap();
        let up = c.execute("UPDATE history_event SET summary = 'x' WHERE id = ?1", [&id]).map_err(map_immutable);
        assert!(matches!(up, Err(ClaraError::HistoryImmutable)));
        let del = c.execute("DELETE FROM history_event WHERE id = ?1", [&id]).map_err(map_immutable);
        assert!(matches!(del, Err(ClaraError::HistoryImmutable)));
    }

    #[test]
    fn chain_detects_tampering() {
        let c = conn();
        for i in 0..5 {
            record(&c, &SystemClock, Actor::Andreia, NewEvent::new("t", None, "t.a", format!("evento {i}")).payload(serde_json::json!({"i": i}))).unwrap();
        }
        assert!(verify_chain(&c).unwrap().ok);
        // Alguém contorna a app: desliga os triggers e altera um evento.
        c.execute_batch("DROP TRIGGER history_event_no_update; UPDATE history_event SET summary = 'adulterado' WHERE seq = 3;").unwrap();
        let r = verify_chain(&c).unwrap();
        assert!(!r.ok);
        assert!(r.problem.unwrap().contains("n.º 3"));
    }

    #[test]
    fn payload_tamper_detected_and_redaction_keeps_chain() {
        let c = conn();
        let id = record(&c, &SystemClock, Actor::Andreia, NewEvent::new("t", None, "t.a", "com conteúdo").payload(serde_json::json!({"texto": "sensível"}))).unwrap();
        // Apagar o conteúdo sem redação é recusado.
        assert!(c.execute("DELETE FROM history_payload WHERE event_id = ?1", [&id]).is_err());
        assert!(matches!(redact_payload(&c, &SystemClock, &id, " "), Err(ClaraError::Invalid(_))));
        redact_payload(&c, &SystemClock, &id, "pedido de expurgo").unwrap();
        assert!(verify_chain(&c).unwrap().ok);
        let ev = list(&c, 10, 0).unwrap().into_iter().find(|e| e.id == id).unwrap();
        assert!(ev.redacted);
    }

    #[test]
    fn compensation_keeps_original() {
        let c = conn();
        let id = record(&c, &SystemClock, Actor::Andreia, NewEvent::new("portal", Some("x"), "t.a", "original")).unwrap();
        let comp = compensate(&c, &SystemClock, &id, "registado por engano", "Correção do evento anterior").unwrap();
        let all = list(&c, 10, 0).unwrap();
        assert!(all.iter().any(|e| e.id == id && e.summary == "original"));
        assert!(all.iter().any(|e| e.id == comp && e.compensates_event_id.as_deref() == Some(id.as_str())));
        assert!(verify_chain(&c).unwrap().ok);
    }

    #[test]
    fn domain_change_and_event_are_atomic() {
        let mut c = conn();
        let before = count(&c).unwrap();
        {
            let tx = c.transaction().unwrap();
            tx.execute("UPDATE portal SET monitoring_enabled = 1 WHERE id = 'vizzit'", []).unwrap();
            record(&tx, &SystemClock, Actor::Andreia, NewEvent::new("portal", Some("vizzit"), "t.a", "x")).unwrap();
            // Falha antes do commit: nada fica gravado.
        }
        assert_eq!(count(&c).unwrap(), before);
        assert!(!crate::catalog::get(&c, "vizzit").unwrap().monitoring_enabled);
    }

    #[test]
    fn migrations_are_idempotent() {
        let mut c = conn();
        assert!(crate::migrations::migrate(&mut c, &SystemClock).unwrap().is_empty());
        assert_eq!(crate::migrations::current_version(&c).unwrap(), crate::migrations::latest_version());
        assert_eq!(crate::catalog::count(&c).unwrap(), 23);
    }
}
