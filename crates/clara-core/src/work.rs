//! Problemas, alterações manuais e QA público.
//!
//! O estado de um problema é derivado das alterações ligadas e do QA:
//! nunca é guardado à parte (evita divergências). Só "cancelado" e
//! "bloqueado" são decisões manuais, sempre com motivo.
//!
//! Regras: registar uma edição cria QA pendente; só QA aprovado resolve;
//! QA falhado reabre, preservando o histórico; uma nova edição num
//! problema resolvido volta a pedir QA.

use chrono::Duration;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};
use crate::property::{self, validate_url};

pub const PRIORITIES: [&str; 4] = ["urgente", "alta", "normal", "baixa"];
/// Depois de editar no EGO, o feed pode demorar até chegar ao portal.
pub const EGO_RECHECK_HOURS: i64 = 48;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IssueState {
    PorResolver,
    Bloqueado,
    QaPendente,
    Reaberto,
    Resolvido,
    Cancelado,
}

pub fn derive_state(manual: Option<&str>, change_statuses: &[String]) -> IssueState {
    if manual == Some("cancelado") {
        return IssueState::Cancelado;
    }
    let active: Vec<&str> = change_statuses.iter().map(String::as_str).filter(|s| *s != "substituido").collect();
    if active.contains(&"qa_pendente") {
        return IssueState::QaPendente;
    }
    if active.contains(&"qa_falhou") {
        return if manual == Some("bloqueado") { IssueState::Bloqueado } else { IssueState::Reaberto };
    }
    if !active.is_empty() && active.iter().all(|s| *s == "qa_aprovado") {
        return IssueState::Resolvido;
    }
    if manual == Some("bloqueado") {
        IssueState::Bloqueado
    } else {
        IssueState::PorResolver
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Issue {
    pub id: String,
    pub property_id: String,
    pub listing_id: Option<String>,
    pub title: String,
    pub priority: String,
    pub note: String,
    pub state: IssueState,
    pub manual_reason: Option<String>,
    pub detected_at: String,
    pub resolved_at: Option<String>,
    pub ego_reference: String,
    pub portal_name: Option<String>,
    pub area: Option<String>,
    pub changes: i64,
}

fn change_statuses(conn: &Connection, issue_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT c.status FROM change c JOIN issue_change ic ON ic.change_id = c.id WHERE ic.issue_id = ?1")?;
    Ok(stmt.query_map([issue_id], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?)
}

const ISSUE_SELECT: &str = "SELECT i.id, i.property_id, i.listing_id, i.title, i.priority, i.note, i.manual_state, i.manual_reason,
    i.detected_at, i.resolved_at, p.ego_reference_original, po.name, ci.area,
    (SELECT count(*) FROM issue_change ic WHERE ic.issue_id = i.id)
    FROM issue i JOIN property p ON p.id = i.property_id
    LEFT JOIN listing l ON l.id = i.listing_id LEFT JOIN portal po ON po.id = l.portal_id
    LEFT JOIN checklist_item ci ON ci.id = i.item_id";

fn issue_from_row(conn: &Connection, r: &rusqlite::Row) -> rusqlite::Result<(Issue, Option<String>)> {
    let manual: Option<String> = r.get(6)?;
    let id: String = r.get(0)?;
    Ok((
        Issue {
            id,
            property_id: r.get(1)?,
            listing_id: r.get(2)?,
            title: r.get(3)?,
            priority: r.get(4)?,
            note: r.get(5)?,
            state: IssueState::PorResolver,
            manual_reason: r.get(7)?,
            detected_at: r.get(8)?,
            resolved_at: r.get(9)?,
            ego_reference: r.get(10)?,
            portal_name: r.get(11)?,
            area: r.get(12)?,
            changes: r.get(13)?,
        },
        manual,
    ))
    .map(|(i, m)| {
        let _ = conn;
        (i, m)
    })
}

fn finish(conn: &Connection, rows: Vec<(Issue, Option<String>)>) -> Result<Vec<Issue>> {
    rows.into_iter()
        .map(|(mut i, manual)| {
            i.state = derive_state(manual.as_deref(), &change_statuses(conn, &i.id)?);
            Ok(i)
        })
        .collect()
}

pub fn get_issue(conn: &Connection, id: &str) -> Result<Issue> {
    let row = conn
        .query_row(&format!("{ISSUE_SELECT} WHERE i.id = ?1"), [id], |r| issue_from_row(conn, r))
        .optional()?
        .ok_or_else(|| ClaraError::NotFound("problema".into()))?;
    Ok(finish(conn, vec![row])?.remove(0))
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct IssueFilter {
    pub property_id: Option<String>,
    pub listing_id: Option<String>,
    /// "abertos" (por defeito), "todos", ou um estado concreto.
    pub state: Option<String>,
}

fn priority_rank(p: &str) -> i32 {
    PRIORITIES.iter().position(|x| *x == p).unwrap_or(9) as i32
}

pub fn list_issues(conn: &Connection, f: &IssueFilter) -> Result<Vec<Issue>> {
    let mut stmt = conn.prepare(&format!(
        "{ISSUE_SELECT} WHERE (?1 IS NULL OR i.property_id = ?1) AND (?2 IS NULL OR i.listing_id = ?2) ORDER BY i.detected_at"
    ))?;
    let rows = stmt
        .query_map(params![f.property_id, f.listing_id], |r| issue_from_row(conn, r))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let mut all = finish(conn, rows)?;
    let wanted = f.state.clone().unwrap_or_else(|| "abertos".into());
    all.retain(|i| match wanted.as_str() {
        "todos" => true,
        "abertos" => !matches!(i.state, IssueState::Resolvido | IssueState::Cancelado),
        s => serde_json::to_value(&i.state).ok().and_then(|v| v.as_str().map(|x| x == s)).unwrap_or(false),
    });
    all.sort_by(|a, b| priority_rank(&a.priority).cmp(&priority_rank(&b.priority)).then(a.detected_at.cmp(&b.detected_at)));
    Ok(all)
}

#[derive(Clone, Debug, Deserialize)]
pub struct NewIssue {
    pub property_id: String,
    pub listing_id: Option<String>,
    pub title: String,
    pub priority: Option<String>,
    pub note: Option<String>,
}

pub fn create_issue(conn: &mut Connection, clock: &dyn Clock, input: NewIssue) -> Result<Issue> {
    let prop = property::get(conn, &input.property_id)?;
    if let Some(l) = &input.listing_id {
        if property::get_listing(conn, l)?.property_id != prop.id {
            return Err(ClaraError::Invalid("a publicação não pertence a este imóvel".into()));
        }
    }
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ClaraError::Invalid("descreve o problema".into()));
    }
    let priority = input.priority.unwrap_or_else(|| "normal".into());
    if !PRIORITIES.contains(&priority.as_str()) {
        return Err(ClaraError::Invalid("prioridade desconhecida".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO issue (id, property_id, listing_id, title, priority, note, detected_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![id, prop.id, input.listing_id, title, priority, input.note.unwrap_or_default().trim(), now],
    )?;
    history::record(&tx, clock, Actor::Andreia, NewEvent::new("issue", Some(&id), "problema.criado", format!("Problema criado: {title} ({})", prop.ego_reference)))?;
    tx.commit()?;
    get_issue(conn, &id)
}

pub fn set_priority(conn: &mut Connection, clock: &dyn Clock, id: &str, priority: &str) -> Result<Issue> {
    if !PRIORITIES.contains(&priority) {
        return Err(ClaraError::Invalid("prioridade desconhecida".into()));
    }
    let before = get_issue(conn, id)?;
    if before.priority == priority {
        return Ok(before);
    }
    let tx = conn.transaction()?;
    tx.execute("UPDATE issue SET priority = ?1, updated_at = ?2 WHERE id = ?3", params![priority, ts(clock.now()), id])?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("issue", Some(id), "problema.prioridade", format!("Prioridade: {} → {}: {}", before.priority, priority, before.title)),
    )?;
    tx.commit()?;
    get_issue(conn, id)
}

/// Cancelar, bloquear ou desbloquear. Cancelar e bloquear exigem motivo.
pub fn set_manual_state(conn: &mut Connection, clock: &dyn Clock, id: &str, state: Option<&str>, reason: &str) -> Result<Issue> {
    let before = get_issue(conn, id)?;
    if before.state == IssueState::Cancelado {
        return Err(ClaraError::Invalid("um problema cancelado não muda de estado".into()));
    }
    let (action, label) = match state {
        Some("cancelado") => ("problema.cancelado", "cancelado"),
        Some("bloqueado") => ("problema.bloqueado", "bloqueado"),
        None => ("problema.desbloqueado", "desbloqueado"),
        _ => return Err(ClaraError::Invalid("estado manual desconhecido".into())),
    };
    if state.is_some() && reason.trim().is_empty() {
        return Err(ClaraError::Invalid("indica o motivo".into()));
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE issue SET manual_state = ?1, manual_reason = ?2, updated_at = ?3 WHERE id = ?4",
        params![state, if state.is_some() { Some(reason.trim()) } else { None }, ts(clock.now()), id],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("issue", Some(id), action, format!("Problema {label}: {}", before.title)).reason(Some(reason.into())),
    )?;
    tx.commit()?;
    get_issue(conn, id)
}

#[derive(Clone, Debug, Serialize)]
pub struct Change {
    pub id: String,
    pub listing_id: String,
    pub field: String,
    pub language: String,
    pub edit_location: String,
    pub description: String,
    pub reason: String,
    pub status: String,
    pub implemented_at: String,
    pub recheck_after: Option<String>,
    pub ego_reference: String,
    pub portal_name: String,
    pub public_url: Option<String>,
    pub issue_titles: Vec<String>,
    pub qa: Vec<QaCheck>,
}

#[derive(Clone, Debug, Serialize)]
pub struct QaCheck {
    pub id: String,
    pub observed_url: Option<String>,
    pub checked_at: String,
    pub result: String,
    pub note: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct NewChange {
    pub listing_id: String,
    pub issue_ids: Vec<String>,
    pub field: String,
    pub language: Option<String>,
    pub edit_location: String,
    pub description: String,
    pub reason: Option<String>,
}

fn load_change(conn: &Connection, id: &str) -> Result<Change> {
    let mut c = conn
        .query_row(
            "SELECT c.id, c.listing_id, c.field, c.language, c.edit_location, c.description, c.reason, c.status,
                    c.implemented_at, c.recheck_after, p.ego_reference_original, po.name, l.public_url
             FROM change c JOIN listing l ON l.id = c.listing_id JOIN property p ON p.id = l.property_id
             JOIN portal po ON po.id = l.portal_id WHERE c.id = ?1",
            [id],
            |r| {
                Ok(Change {
                    id: r.get(0)?,
                    listing_id: r.get(1)?,
                    field: r.get(2)?,
                    language: r.get(3)?,
                    edit_location: r.get(4)?,
                    description: r.get(5)?,
                    reason: r.get(6)?,
                    status: r.get(7)?,
                    implemented_at: r.get(8)?,
                    recheck_after: r.get(9)?,
                    ego_reference: r.get(10)?,
                    portal_name: r.get(11)?,
                    public_url: r.get(12)?,
                    issue_titles: vec![],
                    qa: vec![],
                })
            },
        )
        .optional()?
        .ok_or_else(|| ClaraError::NotFound("alteração".into()))?;
    let mut st = conn.prepare("SELECT i.title FROM issue i JOIN issue_change ic ON ic.issue_id = i.id WHERE ic.change_id = ?1")?;
    c.issue_titles = st.query_map([id], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?;
    let mut st = conn.prepare("SELECT id, observed_url, checked_at, result, note FROM qa_check WHERE change_id = ?1 ORDER BY checked_at")?;
    c.qa = st
        .query_map([id], |r| Ok(QaCheck { id: r.get(0)?, observed_url: r.get(1)?, checked_at: r.get(2)?, result: r.get(3)?, note: r.get(4)? }))?
        .collect::<std::result::Result<_, _>>()?;
    Ok(c)
}

pub fn get_change(conn: &Connection, id: &str) -> Result<Change> {
    load_change(conn, id)
}

/// Alterações de uma publicação, ou todas as que aguardam QA.
pub fn list_changes(conn: &Connection, listing_id: Option<&str>, only_pending: bool) -> Result<Vec<Change>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM change WHERE (?1 IS NULL OR listing_id = ?1) AND (?2 = 0 OR status = 'qa_pendente') ORDER BY implemented_at DESC",
    )?;
    let ids: Vec<String> = stmt.query_map(params![listing_id, only_pending as i64], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?;
    ids.iter().map(|id| load_change(conn, id)).collect()
}

/// Regista uma edição feita à mão no portal ou no EGO. Fica com QA pendente.
pub fn register_change(conn: &mut Connection, clock: &dyn Clock, input: NewChange) -> Result<Change> {
    let listing = property::get_listing(conn, &input.listing_id)?;
    if input.issue_ids.is_empty() {
        return Err(ClaraError::Invalid("liga a edição a pelo menos um problema".into()));
    }
    let field = input.field.trim();
    let description = input.description.trim();
    if field.is_empty() || description.is_empty() {
        return Err(ClaraError::Invalid("indica o campo e o que foi alterado".into()));
    }
    if !["portal", "ego"].contains(&input.edit_location.as_str()) {
        return Err(ClaraError::Invalid("indica onde foi feita a edição: portal ou EGO".into()));
    }
    for iid in &input.issue_ids {
        let issue = get_issue(conn, iid)?;
        if issue.property_id != listing.property_id || issue.listing_id.as_deref().is_some_and(|l| l != listing.id) {
            return Err(ClaraError::Invalid(format!("o problema \"{}\" não é desta publicação", issue.title)));
        }
        if issue.state == IssueState::Cancelado {
            return Err(ClaraError::Invalid(format!("o problema \"{}\" está cancelado", issue.title)));
        }
    }
    let now = clock.now();
    let recheck = (input.edit_location == "ego").then(|| ts(now + Duration::hours(EGO_RECHECK_HOURS)));
    let id = uuid::Uuid::new_v4().to_string();
    let lang = input.language.clone().filter(|l| !l.trim().is_empty()).unwrap_or_else(|| listing.language.clone());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO change (id, listing_id, field, language, edit_location, description, reason, status, implemented_at, recheck_after, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'qa_pendente', ?8, ?9, ?8)",
        params![id, listing.id, field, lang, input.edit_location, description, input.reason.unwrap_or_default().trim(), ts(now), recheck],
    )?;
    for iid in &input.issue_ids {
        // Edições anteriores que falharam o QA ficam substituídas por esta.
        tx.execute(
            "UPDATE change SET status = 'substituido', updated_at = ?1
             WHERE status = 'qa_falhou' AND id IN (SELECT change_id FROM issue_change WHERE issue_id = ?2)",
            params![ts(now), iid],
        )?;
        tx.execute("INSERT INTO issue_change (issue_id, change_id) VALUES (?1, ?2)", params![iid, id])?;
        tx.execute(
            "UPDATE issue SET resolved_at = NULL, manual_state = CASE WHEN manual_state = 'bloqueado' THEN NULL ELSE manual_state END,
               manual_reason = CASE WHEN manual_state = 'bloqueado' THEN NULL ELSE manual_reason END, updated_at = ?1 WHERE id = ?2",
            params![ts(now), iid],
        )?;
    }
    let onde = if input.edit_location == "ego" { "no EGO" } else { "no portal" };
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("change", Some(&id), "edicao.registada", format!("Edição registada {onde}: {field} ({} em {})", listing.ego_reference, listing.portal_name))
            .payload(serde_json::json!({"campo": field, "idioma": lang, "descricao": description, "problemas": input.issue_ids})),
    )?;
    tx.commit()?;
    load_change(conn, &id)
}

fn refresh_resolved(tx: &Connection, clock: &dyn Clock, change_id: &str) -> Result<Vec<(String, IssueState)>> {
    let mut st = tx.prepare("SELECT issue_id FROM issue_change WHERE change_id = ?1")?;
    let issues: Vec<String> = st.query_map([change_id], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?;
    let mut out = vec![];
    for iid in issues {
        let manual: Option<String> = tx.query_row("SELECT manual_state FROM issue WHERE id = ?1", [&iid], |r| r.get(0))?;
        let state = derive_state(manual.as_deref(), &change_statuses(tx, &iid)?);
        let resolved = if state == IssueState::Resolvido { Some(ts(clock.now())) } else { None };
        tx.execute(
            "UPDATE issue SET resolved_at = CASE WHEN ?1 IS NULL THEN NULL ELSE COALESCE(resolved_at, ?1) END, updated_at = ?2 WHERE id = ?3",
            params![resolved, ts(clock.now()), iid],
        )?;
        out.push((iid, state));
    }
    Ok(out)
}

/// QA no anúncio público. Aprovado resolve; falhou reabre; não verificável
/// mantém pendente e exige explicação.
pub fn record_qa(conn: &mut Connection, clock: &dyn Clock, change_id: &str, result: &str, observed_url: Option<String>, note: &str) -> Result<Change> {
    let change = load_change(conn, change_id)?;
    if change.status != "qa_pendente" {
        return Err(ClaraError::Invalid("esta edição já não está à espera de QA".into()));
    }
    let url = observed_url.map(|u| u.trim().to_string()).filter(|u| !u.is_empty());
    match result {
        "aprovado" | "falhou" => {
            let u = url.as_deref().ok_or_else(|| ClaraError::Invalid("indica o URL público que verificaste".into()))?;
            validate_url(u)?;
        }
        "nao_verificavel" => {
            if note.trim().is_empty() {
                return Err(ClaraError::Invalid("explica porque não foi possível verificar".into()));
            }
        }
        _ => return Err(ClaraError::Invalid("resultado de QA desconhecido".into())),
    }
    if result == "falhou" && note.trim().is_empty() {
        return Err(ClaraError::Invalid("indica o que falhou".into()));
    }
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO qa_check (id, change_id, observed_url, checked_at, result, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![uuid::Uuid::new_v4().to_string(), change_id, url, now, result, note.trim()],
    )?;
    let new_status = match result {
        "aprovado" => "qa_aprovado",
        "falhou" => "qa_falhou",
        _ => "qa_pendente",
    };
    tx.execute("UPDATE change SET status = ?1, updated_at = ?2 WHERE id = ?3", params![new_status, now, change_id])?;
    tx.execute("UPDATE listing SET last_observed_at = ?1 WHERE id = ?2", params![now, change.listing_id])?;
    let label = match result {
        "aprovado" => "QA aprovado",
        "falhou" => "QA falhou",
        _ => "QA não verificável",
    };
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("change", Some(change_id), &format!("qa.{result}"), format!("{label}: {} ({} em {})", change.field, change.ego_reference, change.portal_name))
            .reason(Some(note.to_string()))
            .payload(serde_json::json!({"url": url})),
    )?;
    for (iid, state) in refresh_resolved(&tx, clock, change_id)? {
        let action = match state {
            IssueState::Resolvido => Some(("problema.resolvido", "Problema resolvido")),
            IssueState::Reaberto => Some(("problema.reaberto", "Problema reaberto")),
            _ => None,
        };
        if let Some((a, s)) = action {
            let title: String = tx.query_row("SELECT title FROM issue WHERE id = ?1", [&iid], |r| r.get(0))?;
            history::record(&tx, clock, Actor::Sistema, NewEvent::new("issue", Some(&iid), a, format!("{s}: {title}")).origin("qa"))?;
        }
    }
    tx.commit()?;
    load_change(conn, change_id)
}

#[derive(Clone, Debug, Serialize)]
pub struct TodaySummary {
    pub open_issues: i64,
    pub blocked: i64,
    pub reopened: i64,
    pub qa_pending: i64,
    pub draft_audits: i64,
    pub properties: i64,
    pub listings: i64,
}

pub fn today(conn: &Connection) -> Result<TodaySummary> {
    let open = list_issues(conn, &IssueFilter::default())?;
    let count = |s: IssueState| open.iter().filter(|i| i.state == s).count() as i64;
    let q = |sql: &str| conn.query_row(sql, [], |r| r.get::<_, i64>(0));
    Ok(TodaySummary {
        open_issues: open.len() as i64,
        blocked: count(IssueState::Bloqueado),
        reopened: count(IssueState::Reaberto),
        qa_pending: q("SELECT count(*) FROM change WHERE status = 'qa_pendente'")?,
        draft_audits: q("SELECT count(*) FROM audit WHERE status = 'rascunho'")?,
        properties: q("SELECT count(*) FROM property WHERE archived_at IS NULL")?,
        listings: q("SELECT count(*) FROM listing l JOIN property p ON p.id = l.property_id WHERE p.archived_at IS NULL")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SystemClock;
    use crate::property::{add_listing, create, ListingInput};

    fn setup() -> (Connection, String, String, String) {
        let mut c = Connection::open_in_memory().unwrap();
        crate::migrations::migrate(&mut c, &SystemClock).unwrap();
        let (p, _) = create(&mut c, &SystemClock, "EGO-77", "T2", None).unwrap();
        let mk = |c: &mut Connection, portal: &str| {
            add_listing(
                c,
                &SystemClock,
                &p.id,
                ListingInput { portal_id: portal.into(), portal_reference: None, public_url: Some(format!("https://{portal}.test/a")), language: None, visibility_status: None },
            )
            .unwrap()
            .id
        };
        let l1 = mk(&mut c, "idealista-pt");
        let l2 = mk(&mut c, "imovirtual");
        (c, p.id, l1, l2)
    }

    fn issue(c: &mut Connection, p: &str, l: &str, t: &str) -> String {
        create_issue(c, &SystemClock, NewIssue { property_id: p.into(), listing_id: Some(l.into()), title: t.into(), priority: None, note: None }).unwrap().id
    }

    fn edit(c: &mut Connection, l: &str, issues: Vec<String>, where_: &str) -> String {
        register_change(
            c,
            &SystemClock,
            NewChange { listing_id: l.into(), issue_ids: issues, field: "Descrição".into(), language: None, edit_location: where_.into(), description: "Texto otimizado".into(), reason: None },
        )
        .unwrap()
        .id
    }

    #[test]
    fn derive_rules() {
        let s = |v: &[&str]| v.iter().map(|x| x.to_string()).collect::<Vec<_>>();
        assert_eq!(derive_state(None, &[]), IssueState::PorResolver);
        assert_eq!(derive_state(Some("bloqueado"), &[]), IssueState::Bloqueado);
        assert_eq!(derive_state(None, &s(&["qa_pendente"])), IssueState::QaPendente);
        assert_eq!(derive_state(None, &s(&["qa_aprovado", "qa_pendente"])), IssueState::QaPendente);
        assert_eq!(derive_state(None, &s(&["qa_falhou"])), IssueState::Reaberto);
        assert_eq!(derive_state(None, &s(&["substituido", "qa_aprovado"])), IssueState::Resolvido);
        assert_eq!(derive_state(Some("cancelado"), &s(&["qa_aprovado"])), IssueState::Cancelado);
    }

    #[test]
    fn ac12_change_qa_resolve_and_reopen() {
        let (mut c, p, l1, _) = setup();
        let i = issue(&mut c, &p, &l1, "Descrição fraca");
        let ch = edit(&mut c, &l1, vec![i.clone()], "portal");
        assert_eq!(get_issue(&c, &i).unwrap().state, IssueState::QaPendente);
        // Sem URL não há QA aprovado; falhar exige explicação.
        assert!(record_qa(&mut c, &SystemClock, &ch, "aprovado", None, "").is_err());
        assert!(record_qa(&mut c, &SystemClock, &ch, "falhou", Some("https://x.test/a".into()), "").is_err());
        // Não verificável mantém pendente.
        record_qa(&mut c, &SystemClock, &ch, "nao_verificavel", None, "Portal em manutenção").unwrap();
        assert_eq!(get_issue(&c, &i).unwrap().state, IssueState::QaPendente);
        // Falhou: reabre e preserva a edição.
        record_qa(&mut c, &SystemClock, &ch, "falhou", Some("https://x.test/a".into()), "Texto antigo ainda visível").unwrap();
        assert_eq!(get_issue(&c, &i).unwrap().state, IssueState::Reaberto);
        assert_eq!(get_change(&c, &ch).unwrap().qa.len(), 2);
        // Nova edição substitui a falhada; QA aprovado resolve.
        let ch2 = edit(&mut c, &l1, vec![i.clone()], "portal");
        assert_eq!(get_change(&c, &ch).unwrap().status, "substituido");
        record_qa(&mut c, &SystemClock, &ch2, "aprovado", Some("https://x.test/a".into()), "").unwrap();
        let resolved = get_issue(&c, &i).unwrap();
        assert_eq!(resolved.state, IssueState::Resolvido);
        assert!(resolved.resolved_at.is_some());
        assert!(record_qa(&mut c, &SystemClock, &ch2, "aprovado", Some("https://x.test/a".into()), "").is_err());
        // Edição posterior invalida a resolução até novo QA.
        edit(&mut c, &l1, vec![i.clone()], "ego");
        let again = get_issue(&c, &i).unwrap();
        assert_eq!(again.state, IssueState::QaPendente);
        assert!(again.resolved_at.is_none());
        assert!(history::verify_chain(&c).unwrap().ok);
    }

    #[test]
    fn ego_edit_sets_recheck_and_rules_on_links() {
        let (mut c, p, l1, l2) = setup();
        let i = issue(&mut c, &p, &l1, "Planta");
        let ch = edit(&mut c, &l1, vec![i.clone()], "ego");
        assert!(get_change(&c, &ch).unwrap().recheck_after.is_some());
        // Não se liga um problema de outra publicação.
        let r = register_change(
            &mut c,
            &SystemClock,
            NewChange { listing_id: l2, issue_ids: vec![i], field: "x".into(), language: None, edit_location: "portal".into(), description: "y".into(), reason: None },
        );
        assert!(r.is_err());
    }

    #[test]
    fn cancel_needs_reason_and_is_not_resolution() {
        let (mut c, p, l1, _) = setup();
        let i = issue(&mut c, &p, &l1, "Vídeo");
        assert!(set_manual_state(&mut c, &SystemClock, &i, Some("cancelado"), " ").is_err());
        let x = set_manual_state(&mut c, &SystemClock, &i, Some("cancelado"), "Imóvel sem vídeo").unwrap();
        assert_eq!(x.state, IssueState::Cancelado);
        assert!(x.resolved_at.is_none());
        assert!(list_issues(&c, &IssueFilter::default()).unwrap().is_empty());
        assert_eq!(list_issues(&c, &IssueFilter { state: Some("cancelado".into()), ..Default::default() }).unwrap().len(), 1);
    }

    #[test]
    fn blocked_until_work_and_today_counts() {
        let (mut c, p, l1, _) = setup();
        let i = issue(&mut c, &p, &l1, "Fotos");
        set_manual_state(&mut c, &SystemClock, &i, Some("bloqueado"), "À espera de material").unwrap();
        let t = today(&c).unwrap();
        assert_eq!((t.open_issues, t.blocked, t.properties, t.listings), (1, 1, 1, 2));
        edit(&mut c, &l1, vec![i.clone()], "portal");
        assert_eq!(get_issue(&c, &i).unwrap().state, IssueState::QaPendente);
        assert_eq!(today(&c).unwrap().qa_pending, 1);
    }
}
