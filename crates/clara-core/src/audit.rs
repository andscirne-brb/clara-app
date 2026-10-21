//! Auditorias de publicações com a checklist versionada.
//!
//! Estados de cada item: conforme, não conforme, por verificar, não
//! aplicável (com motivo). Completude e cobertura mostram sempre os
//! denominadores; sem itens avaliados, o valor é N/D (nunca zero).

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};
use crate::property;

pub const RESULTS: [&str; 4] = ["conforme", "nao_conforme", "por_verificar", "nao_aplicavel"];

#[derive(Clone, Debug, Serialize)]
pub struct AuditItem {
    pub item_id: String,
    pub area: String,
    pub code: String,
    pub label: String,
    pub hint: String,
    pub result: String,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Metrics {
    pub total: i64,
    pub conforme: i64,
    pub nao_conforme: i64,
    pub por_verificar: i64,
    pub nao_aplicavel: i64,
    /// conformes / avaliados aplicáveis; None = N/D.
    pub completude: Option<f64>,
    /// avaliados / aplicáveis; None = N/D.
    pub cobertura: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Audit {
    pub id: String,
    pub listing_id: String,
    pub checklist_version: i64,
    pub status: String,
    pub notes: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub items: Vec<AuditItem>,
    pub metrics: Metrics,
}

#[derive(Clone, Debug, Serialize)]
pub struct AuditSummary {
    pub id: String,
    pub listing_id: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub checklist_version: i64,
    pub metrics: Metrics,
}

pub fn metrics_from(results: &[&str]) -> Metrics {
    let count = |k: &str| results.iter().filter(|r| **r == k).count() as i64;
    let (c, nc, pv, na) = (count("conforme"), count("nao_conforme"), count("por_verificar"), count("nao_aplicavel"));
    let total = results.len() as i64;
    let aplicaveis = total - na;
    let avaliados = c + nc;
    Metrics {
        total,
        conforme: c,
        nao_conforme: nc,
        por_verificar: pv,
        nao_aplicavel: na,
        completude: if avaliados == 0 { None } else { Some(c as f64 / avaliados as f64) },
        cobertura: if aplicaveis == 0 { None } else { Some(avaliados as f64 / aplicaveis as f64) },
    }
}

fn current_version(conn: &Connection) -> Result<(String, i64)> {
    Ok(conn.query_row("SELECT id, version FROM checklist_version ORDER BY version DESC LIMIT 1", [], |r| Ok((r.get(0)?, r.get(1)?)))?)
}

fn map_frozen(e: rusqlite::Error) -> ClaraError {
    if e.to_string().contains("audit_completed") {
        ClaraError::Invalid("esta auditoria já foi concluída; para corrigir, começa uma nova".into())
    } else {
        ClaraError::Db(e)
    }
}

/// Começa uma auditoria ou devolve o rascunho que já existir para a publicação.
pub fn start(conn: &mut Connection, clock: &dyn Clock, listing_id: &str) -> Result<Audit> {
    let listing = property::get_listing(conn, listing_id)?;
    if let Some(id) = conn
        .query_row("SELECT id FROM audit WHERE listing_id = ?1 AND status = 'rascunho'", [listing_id], |r| r.get::<_, String>(0))
        .optional()?
    {
        return get(conn, &id);
    }
    let (version_id, version) = current_version(conn)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO audit (id, listing_id, checklist_version_id, status, started_at) VALUES (?1, ?2, ?3, 'rascunho', ?4)",
        params![id, listing_id, version_id, now],
    )?;
    tx.execute(
        "INSERT INTO audit_result (audit_id, item_id, result, updated_at)
         SELECT ?1, id, 'por_verificar', ?2 FROM checklist_item WHERE version_id = ?3",
        params![id, now, version_id],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("audit", Some(&id), "auditoria.iniciada", format!("Auditoria iniciada: {} em {} (checklist v{version})", listing.ego_reference, listing.portal_name)),
    )?;
    tx.commit()?;
    get(conn, &id)
}

pub fn get(conn: &Connection, id: &str) -> Result<Audit> {
    let (listing_id, version, status, notes, started_at, completed_at): (String, i64, String, String, String, Option<String>) = conn
        .query_row(
            "SELECT a.listing_id, v.version, a.status, a.notes, a.started_at, a.completed_at
             FROM audit a JOIN checklist_version v ON v.id = a.checklist_version_id WHERE a.id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .optional()?
        .ok_or_else(|| ClaraError::NotFound("auditoria".into()))?;
    let mut stmt = conn.prepare(
        "SELECT i.id, i.area, i.code, i.label, i.hint, r.result, r.note
         FROM audit_result r JOIN checklist_item i ON i.id = r.item_id WHERE r.audit_id = ?1 ORDER BY i.sort_order",
    )?;
    let items: Vec<AuditItem> = stmt
        .query_map([id], |r| {
            Ok(AuditItem { item_id: r.get(0)?, area: r.get(1)?, code: r.get(2)?, label: r.get(3)?, hint: r.get(4)?, result: r.get(5)?, note: r.get(6)? })
        })?
        .collect::<std::result::Result<_, _>>()?;
    let metrics = metrics_from(&items.iter().map(|i| i.result.as_str()).collect::<Vec<_>>());
    Ok(Audit { id: id.into(), listing_id, checklist_version: version, status, notes, started_at, completed_at, items, metrics })
}

pub fn list_for_listing(conn: &Connection, listing_id: &str) -> Result<Vec<AuditSummary>> {
    let mut stmt = conn.prepare("SELECT id FROM audit WHERE listing_id = ?1 ORDER BY started_at DESC")?;
    let ids: Vec<String> = stmt.query_map([listing_id], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?;
    ids.iter()
        .map(|id| {
            let a = get(conn, id)?;
            Ok(AuditSummary {
                id: a.id,
                listing_id: a.listing_id,
                status: a.status,
                started_at: a.started_at,
                completed_at: a.completed_at,
                checklist_version: a.checklist_version,
                metrics: a.metrics,
            })
        })
        .collect()
}

/// Grava o resultado de um item num rascunho (gravação imediata).
pub fn set_result(conn: &Connection, clock: &dyn Clock, audit_id: &str, item_id: &str, result: &str, note: &str) -> Result<()> {
    if !RESULTS.contains(&result) {
        return Err(ClaraError::Invalid("resultado desconhecido".into()));
    }
    let n = conn
        .execute(
            "UPDATE audit_result SET result = ?1, note = ?2, updated_at = ?3 WHERE audit_id = ?4 AND item_id = ?5",
            params![result, note.trim(), ts(clock.now()), audit_id, item_id],
        )
        .map_err(map_frozen)?;
    if n == 0 {
        return Err(ClaraError::NotFound("item da auditoria".into()));
    }
    Ok(())
}

pub fn set_notes(conn: &Connection, audit_id: &str, notes: &str) -> Result<()> {
    let n = conn.execute("UPDATE audit SET notes = ?1 WHERE id = ?2 AND status = 'rascunho'", params![notes.trim(), audit_id])?;
    if n == 0 {
        return Err(ClaraError::Invalid("só um rascunho pode ser alterado".into()));
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize)]
pub struct CompleteResult {
    pub audit: Audit,
    pub issues_created: Vec<String>,
    pub issues_already_open: i64,
}

/// Conclui a auditoria e cria um problema por cada item não conforme,
/// sem duplicar problemas ainda abertos para o mesmo item e publicação.
pub fn complete(conn: &mut Connection, clock: &dyn Clock, audit_id: &str) -> Result<CompleteResult> {
    let audit = get(conn, audit_id)?;
    if audit.status != "rascunho" {
        return Err(ClaraError::Invalid("esta auditoria já foi concluída".into()));
    }
    if let Some(i) = audit.items.iter().find(|i| i.result == "nao_aplicavel" && i.note.trim().is_empty()) {
        return Err(ClaraError::Invalid(format!("indica o motivo de \"não aplicável\" em: {}", i.label)));
    }
    let listing = property::get_listing(conn, &audit.listing_id)?;
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    let mut created = vec![];
    let mut already = 0;
    for item in audit.items.iter().filter(|i| i.result == "nao_conforme") {
        let open: i64 = tx.query_row(
            "SELECT count(*) FROM issue i
             JOIN checklist_item ci ON ci.id = i.item_id
             WHERE i.listing_id = ?1 AND ci.code = ?2 AND i.resolved_at IS NULL AND i.manual_state IS NOT 'cancelado'",
            params![audit.listing_id, item.code],
            |r| r.get(0),
        )?;
        if open > 0 {
            already += 1;
            continue;
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO issue (id, property_id, listing_id, audit_id, item_id, title, note, detected_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![id, listing.property_id, listing.id, audit_id, item.item_id, item.label, item.note, now],
        )?;
        history::record(
            &tx,
            clock,
            Actor::Sistema,
            NewEvent::new("issue", Some(&id), "problema.detetado", format!("Problema: {} ({} em {})", item.label, listing.ego_reference, listing.portal_name))
                .origin("auditoria"),
        )?;
        created.push(id);
    }
    tx.execute("UPDATE audit SET status = 'concluida', completed_at = ?1 WHERE id = ?2", params![now, audit_id])?;
    tx.execute("UPDATE listing SET last_observed_at = ?1, updated_at = ?1 WHERE id = ?2", params![now, listing.id])?;
    let m = &audit.metrics;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "audit",
            Some(audit_id),
            "auditoria.concluida",
            format!(
                "Auditoria concluída: {} em {}. {} conformes, {} não conformes, {} por verificar, {} não aplicáveis",
                listing.ego_reference, listing.portal_name, m.conforme, m.nao_conforme, m.por_verificar, m.nao_aplicavel
            ),
        ),
    )?;
    tx.commit()?;
    Ok(CompleteResult { audit: get(conn, audit_id)?, issues_created: created, issues_already_open: already })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SystemClock;
    use crate::property::{add_listing, create, ListingInput};

    pub(crate) fn setup() -> (Connection, String) {
        let mut c = Connection::open_in_memory().unwrap();
        crate::migrations::migrate(&mut c, &SystemClock).unwrap();
        let (p, _) = create(&mut c, &SystemClock, "EGO-9", "T3", None).unwrap();
        let l = add_listing(
            &mut c,
            &SystemClock,
            &p.id,
            ListingInput { portal_id: "idealista-pt".into(), portal_reference: Some("R1".into()), public_url: Some("https://exemplo.test/1".into()), language: None, visibility_status: None },
        )
        .unwrap();
        (c, l.id)
    }

    #[test]
    fn ac08_metrics_show_denominators_and_nd() {
        let m = metrics_from(&["por_verificar", "nao_aplicavel"]);
        assert_eq!(m.completude, None);
        assert_eq!(m.cobertura, Some(0.0));
        assert_eq!(metrics_from(&["nao_aplicavel"]).cobertura, None);
        let m = metrics_from(&["conforme", "conforme", "nao_conforme", "por_verificar", "nao_aplicavel"]);
        assert_eq!(m.completude, Some(2.0 / 3.0));
        assert_eq!(m.cobertura, Some(3.0 / 4.0));
    }

    #[test]
    fn ac07_na_needs_reason_and_completed_audit_is_frozen() {
        let (mut c, l) = setup();
        let a = start(&mut c, &SystemClock, &l).unwrap();
        assert_eq!(a.items.len(), 20);
        assert_eq!(a.checklist_version, 1);
        // Começar de novo devolve o mesmo rascunho.
        assert_eq!(start(&mut c, &SystemClock, &l).unwrap().id, a.id);
        let video = a.items.iter().find(|i| i.code == "video.publicado").unwrap();
        set_result(&c, &SystemClock, &a.id, &video.item_id, "nao_aplicavel", "").unwrap();
        assert!(matches!(complete(&mut c, &SystemClock, &a.id), Err(ClaraError::Invalid(_))));
        set_result(&c, &SystemClock, &a.id, &video.item_id, "nao_aplicavel", "Sem vídeo no EGO").unwrap();
        complete(&mut c, &SystemClock, &a.id).unwrap();
        assert!(set_result(&c, &SystemClock, &a.id, &video.item_id, "conforme", "").is_err());
    }

    #[test]
    fn issues_created_without_duplicates() {
        let (mut c, l) = setup();
        let a = start(&mut c, &SystemClock, &l).unwrap();
        let planta = a.items.iter().find(|i| i.code == "planta.publicada").unwrap().item_id.clone();
        set_result(&c, &SystemClock, &a.id, &planta, "nao_conforme", "Planta em falta").unwrap();
        let r = complete(&mut c, &SystemClock, &a.id).unwrap();
        assert_eq!(r.issues_created.len(), 1);
        let a2 = start(&mut c, &SystemClock, &l).unwrap();
        assert_ne!(a2.id, a.id);
        let planta2 = a2.items.iter().find(|i| i.code == "planta.publicada").unwrap().item_id.clone();
        set_result(&c, &SystemClock, &a2.id, &planta2, "nao_conforme", "").unwrap();
        let r2 = complete(&mut c, &SystemClock, &a2.id).unwrap();
        assert!(r2.issues_created.is_empty());
        assert_eq!(r2.issues_already_open, 1);
        assert!(history::verify_chain(&c).unwrap().ok);
    }
}
