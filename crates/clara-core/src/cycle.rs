//! Ciclo local: imóvel → publicação → auditoria → edição manual → QA público.
use crate::{
    ClaraError, Result, catalog,
    clock::{Clock, ts},
    history::{self, Actor, NewEvent},
};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

fn invalid(message: &str) -> ClaraError {
    ClaraError::Invalid(message.into())
}
pub fn text(value: &str, label: &str, max: usize, required: bool) -> Result<String> {
    let value = value.trim();
    if (required && value.is_empty())
        || value.chars().count() > max
        || value
            .chars()
            .any(|c| c.is_control() && c != '\n' && c != '\t')
    {
        return Err(invalid(&format!(
            "Revê {label}: {} e até {max} caracteres.",
            if required {
                "preenchimento obrigatório"
            } else {
                "texto válido"
            }
        )));
    }
    Ok(value.to_string())
}
pub fn public_url(value: &str, required: bool) -> Result<String> {
    let value = text(value, "URL pública", 2048, required)?;
    if value.is_empty() {
        return Ok(value);
    }
    let parsed = url::Url::parse(&value)
        .map_err(|_| invalid("A URL pública tem de começar por https:// e incluir um domínio."))?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(invalid("Usa uma URL pública https:// sem credenciais."));
    }
    Ok(parsed.to_string())
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PropertyInput {
    pub ego_ref: String,
    pub nature: String,
    pub municipality: String,
    pub availability: String,
    #[serde(default)]
    pub ego_modified: String,
}
impl PropertyInput {
    pub fn validated(&self) -> Result<Self> {
        Ok(Self {
            ego_ref: text(&self.ego_ref, "referência EGO", 100, true)?,
            nature: text(&self.nature, "natureza", 150, false)?,
            municipality: text(&self.municipality, "concelho", 150, false)?,
            availability: text(&self.availability, "disponibilidade", 100, false)?,
            ego_modified: text(&self.ego_modified, "data de alteração EGO", 10, false)?,
        })
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Property {
    pub id: String,
    pub ego_ref: String,
    pub nature: String,
    pub municipality: String,
    pub availability: String,
    pub ego_modified: String,
    pub original_description: Option<String>,
    pub archived: bool,
    pub updated_at: String,
}
fn property_row(r: &rusqlite::Row) -> rusqlite::Result<Property> {
    Ok(Property {
        id: r.get(0)?,
        ego_ref: r.get(1)?,
        nature: r.get(2)?,
        municipality: r.get(3)?,
        availability: r.get(4)?,
        ego_modified: r.get(5)?,
        original_description: r.get(6)?,
        archived: r.get(7)?,
        updated_at: r.get(8)?,
    })
}
const PROPERTY_SELECT: &str = "SELECT id,ego_ref,nature,municipality,availability,ego_modified,original_description,archived,updated_at FROM property";
pub fn get_property(conn: &Connection, id: &str) -> Result<Property> {
    conn.query_row(
        &format!("{PROPERTY_SELECT} WHERE id=?1"),
        [id],
        property_row,
    )
    .optional()?
    .ok_or_else(|| invalid("Imóvel não encontrado."))
}
pub fn property_by_ref(conn: &Connection, reference: &str) -> Result<Option<Property>> {
    Ok(conn
        .query_row(
            &format!("{PROPERTY_SELECT} WHERE ego_ref=?1"),
            [reference],
            property_row,
        )
        .optional()?)
}
pub fn properties(conn: &Connection) -> Result<Vec<Property>> {
    Ok(conn
        .prepare(&format!("{PROPERTY_SELECT} ORDER BY ego_ref"))?
        .query_map([], property_row)?
        .collect::<std::result::Result<_, _>>()?)
}
pub(crate) fn write_property(
    conn: &Connection,
    clock: &dyn Clock,
    input: &PropertyInput,
    description: Option<&str>,
    origin: &str,
) -> Result<Property> {
    let input = input.validated()?;
    let before = property_by_ref(conn, &input.ego_ref)?;
    let id = before
        .as_ref()
        .map(|p| p.id.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = ts(clock.now());
    conn.execute("INSERT INTO property(id,ego_ref,nature,municipality,availability,ego_modified,original_description,created_at,updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8) ON CONFLICT(ego_ref) DO UPDATE SET nature=excluded.nature,municipality=excluded.municipality,
        availability=excluded.availability,ego_modified=excluded.ego_modified,original_description=COALESCE(excluded.original_description,property.original_description),updated_at=excluded.updated_at",
        params![id,input.ego_ref,input.nature,input.municipality,input.availability,input.ego_modified,description,now])?;
    let after = get_property(conn, &id)?;
    history::record(
        conn,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(&id),
            if before.is_some() {
                "imovel.atualizado"
            } else {
                "imovel.criado"
            },
            "Dados mínimos do imóvel guardados",
        )
        .origin(origin)
        .payload(serde_json::json!({"antes":before,"depois":after})),
    )?;
    Ok(after)
}
pub fn create_property(
    conn: &mut Connection,
    clock: &dyn Clock,
    input: PropertyInput,
) -> Result<Property> {
    let input = input.validated()?;
    let tx = conn.transaction()?;
    if let Some(existing) = property_by_ref(&tx, &input.ego_ref)? {
        return Ok(existing);
    }
    let result = write_property(&tx, clock, &input, None, "manual")?;
    tx.commit()?;
    Ok(result)
}
pub fn archive_property(
    conn: &mut Connection,
    clock: &dyn Clock,
    id: &str,
    archived: bool,
) -> Result<Property> {
    let tx = conn.transaction()?;
    let before = get_property(&tx, id)?;
    if before.archived == archived {
        return Ok(before);
    }
    tx.execute(
        "UPDATE property SET archived=?1,updated_at=?2 WHERE id=?3",
        params![archived, ts(clock.now()), id],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(id),
            "imovel.arquivo",
            if archived {
                "Imóvel arquivado"
            } else {
                "Imóvel reativado"
            },
        ),
    )?;
    let result = get_property(&tx, id)?;
    tx.commit()?;
    Ok(result)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ListingInput {
    pub property_id: String,
    pub portal_id: String,
    pub portal_ref: String,
    pub url: String,
    pub visibility: String,
    pub monitoring: bool,
}
#[derive(Clone, Debug, Serialize)]
pub struct Listing {
    pub id: String,
    pub property_id: String,
    pub portal_id: String,
    pub portal_name: String,
    /// "feed_only": o destino recebe os dados do EGO e não se edita no portal.
    pub portal_group: String,
    pub portal_ref: String,
    pub url: String,
    pub visibility: String,
    pub monitoring: bool,
    pub revision: i64,
}
const LISTING_SELECT: &str = "SELECT l.id,l.property_id,l.portal_id,p.name,l.portal_ref,l.url,l.visibility,l.monitoring,l.revision,p.grupo FROM listing l JOIN portal p ON p.id=l.portal_id";
fn listing_row(r: &rusqlite::Row) -> rusqlite::Result<Listing> {
    Ok(Listing {
        id: r.get(0)?,
        property_id: r.get(1)?,
        portal_id: r.get(2)?,
        portal_name: r.get(3)?,
        portal_ref: r.get(4)?,
        url: r.get(5)?,
        visibility: r.get(6)?,
        monitoring: r.get(7)?,
        revision: r.get(8)?,
        portal_group: r.get(9)?,
    })
}
pub fn listing(conn: &Connection, id: &str) -> Result<Listing> {
    conn.query_row(
        &format!("{LISTING_SELECT} WHERE l.id=?1"),
        [id],
        listing_row,
    )
    .optional()?
    .ok_or_else(|| invalid("Publicação não encontrada."))
}
pub fn listings(conn: &Connection) -> Result<Vec<Listing>> {
    Ok(conn
        .prepare(&format!("{LISTING_SELECT} ORDER BY p.sort_order"))?
        .query_map([], listing_row)?
        .collect::<std::result::Result<_, _>>()?)
}
pub fn save_listing(
    conn: &mut Connection,
    clock: &dyn Clock,
    id: Option<String>,
    input: ListingInput,
) -> Result<Listing> {
    let reference = text(&input.portal_ref, "referência do portal", 100, false)?;
    let url = public_url(&input.url, false)?;
    if !["desconhecida", "ativa", "inativa", "retirada"].contains(&input.visibility.as_str()) {
        return Err(invalid("Visibilidade inválida."));
    }
    let tx = conn.transaction()?;
    get_property(&tx, &input.property_id)?;
    catalog::get(&tx, &input.portal_id)?;
    let before = id.as_deref().map(|id| listing(&tx, id)).transpose()?;
    if before
        .as_ref()
        .is_some_and(|l| l.property_id != input.property_id || l.portal_id != input.portal_id)
    {
        return Err(invalid(
            "Não é possível mudar o imóvel ou destino de uma publicação existente.",
        ));
    }
    let id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let duplicate: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM listing WHERE property_id=?1 AND portal_id=?2 AND id<>?3)",
        params![input.property_id, input.portal_id, id],
        |r| r.get(0),
    )?;
    if duplicate {
        return Err(invalid(
            "Este imóvel já tem uma publicação nesse destino. Abre a publicação existente.",
        ));
    }
    if before.as_ref().is_some_and(|l| {
        l.portal_ref == reference
            && l.url == url
            && l.visibility == input.visibility
            && l.monitoring == input.monitoring
    }) {
        return Ok(before.unwrap());
    }
    let now = ts(clock.now());
    tx.execute("INSERT INTO listing(id,property_id,portal_id,portal_ref,url,visibility,monitoring,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)
        ON CONFLICT(id) DO UPDATE SET portal_ref=excluded.portal_ref,url=excluded.url,visibility=excluded.visibility,monitoring=excluded.monitoring,revision=listing.revision+1,updated_at=excluded.updated_at",
        params![id,input.property_id,input.portal_id,reference,url,input.visibility,input.monitoring,now])?;
    let after = listing(&tx, &id)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "listing",
            Some(&id),
            "publicacao.guardada",
            "Publicação guardada; validações anteriores preservadas por versão",
        )
        .payload(serde_json::json!({"antes":before,"depois":after})),
    )?;
    tx.commit()?;
    Ok(after)
}

pub const CHECKLIST_VERSION: &str = "base-1";
pub const CHECKLIST: &[(&str, &str)] = &[
    ("identificacao", "Identificação e URL"),
    ("fotografias", "Fotografias"),
    ("alt", "Textos alternativos, se suportados"),
    ("descricao", "Descrição"),
    ("titulo", "Título"),
    ("video", "Vídeo, se aplicável"),
    ("planta", "Planta, se aplicável"),
    ("caracteristicas", "Características"),
    ("idiomas", "Idiomas aplicáveis"),
    ("consistencia", "Consistência EGO e portal"),
    ("publico", "Experiência pública"),
];
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuditItem {
    pub field: String,
    pub state: String,
    pub note: String,
}
#[derive(Serialize)]
pub struct Audit {
    pub id: String,
    pub listing_id: String,
    pub listing_revision: i64,
    pub checklist_version: String,
    pub rules_status: String,
    pub items: Vec<AuditItem>,
    pub created_at: String,
}
pub fn audit_draft(conn: &Connection, listing_id: &str) -> Result<Option<Vec<AuditItem>>> {
    let json: Option<String> = conn
        .query_row(
            "SELECT items_json FROM audit_draft WHERE listing_id=?1",
            [listing_id],
            |r| r.get(0),
        )
        .optional()?;
    json.map(|s| serde_json::from_str(&s).map_err(ClaraError::from))
        .transpose()
}
pub fn save_audit_draft(
    conn: &Connection,
    clock: &dyn Clock,
    listing_id: &str,
    items: Vec<AuditItem>,
) -> Result<()> {
    listing(conn, listing_id)?;
    if items.len() != CHECKLIST.len() {
        return Err(invalid("Rascunho de auditoria inválido."));
    }
    for item in &items {
        text(&item.note, "observação", 4000, false)?;
    }
    conn.execute("INSERT INTO audit_draft VALUES(?1,?2,?3) ON CONFLICT(listing_id) DO UPDATE SET items_json=excluded.items_json,updated_at=excluded.updated_at",params![listing_id,serde_json::to_string(&items)?,ts(clock.now())])?;
    Ok(())
}
pub fn audits(conn: &Connection, listing_id: &str) -> Result<Vec<Audit>> {
    let mut stmt=conn.prepare("SELECT id,listing_id,listing_revision,checklist_version,rules_status,items_json,created_at FROM audit WHERE listing_id=?1 ORDER BY rowid DESC")?;
    let rows = stmt.query_map([listing_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, String>(6)?,
        ))
    })?;
    rows.map(|r| {
        let (id, listing_id, listing_revision, checklist_version, rules_status, json, created_at) =
            r?;
        Ok(Audit {
            id,
            listing_id,
            listing_revision,
            checklist_version,
            rules_status,
            items: serde_json::from_str(&json)?,
            created_at,
        })
    })
    .collect()
}
pub fn record_audit(
    conn: &mut Connection,
    clock: &dyn Clock,
    listing_id: &str,
    items: Vec<AuditItem>,
) -> Result<String> {
    if items.len() != CHECKLIST.len() {
        return Err(invalid(
            "A auditoria tem de incluir todos os itens da checklist.",
        ));
    }
    let mut fields = std::collections::HashSet::new();
    for item in &items {
        if !CHECKLIST.iter().any(|(f, _)| *f == item.field)
            || !fields.insert(&item.field)
            || !["conforme", "nao_conforme", "por_verificar", "nao_aplicavel"]
                .contains(&item.state.as_str())
        {
            return Err(invalid("Item de auditoria inválido ou repetido."));
        }
        text(
            &item.note,
            "observação",
            4000,
            item.state == "nao_aplicavel" || item.state == "nao_conforme",
        )?;
    }
    let tx = conn.transaction()?;
    let l = listing(&tx, listing_id)?;
    let portal = catalog::get(&tx, &l.portal_id)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    tx.execute(
        "INSERT INTO audit VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            id,
            listing_id,
            l.revision,
            CHECKLIST_VERSION,
            portal.rules_status,
            serde_json::to_string(&items)?,
            now
        ],
    )?;
    for item in items.iter().filter(|i| i.state == "nao_conforme") {
        let existing = issues(&tx, Some(listing_id))?
            .into_iter()
            .any(|i| i.field == item.field && i.status != "resolvido");
        if !existing {
            let issue_id = uuid::Uuid::new_v4().to_string();
            let title = CHECKLIST.iter().find(|(f, _)| *f == item.field).unwrap().1;
            tx.execute(
                "INSERT INTO issue VALUES(?1,?2,?3,?4,?5,?6)",
                params![issue_id, listing_id, id, item.field, title, now],
            )?;
            history::record(
                &tx,
                clock,
                Actor::Andreia,
                NewEvent::new(
                    "issue",
                    Some(&issue_id),
                    "problema.detetado",
                    "Problema identificado na auditoria",
                ),
            )?;
        }
    }
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "audit",
            Some(&id),
            "auditoria.registada",
            "Auditoria guardada com checklist-base e estado das regras do destino",
        ),
    )?;
    tx.execute("DELETE FROM audit_draft WHERE listing_id=?1", [listing_id])?;
    tx.commit()?;
    Ok(id)
}

#[derive(Serialize)]
pub struct Issue {
    pub id: String,
    pub listing_id: String,
    pub field: String,
    pub title: String,
    pub status: String,
    pub change_id: Option<String>,
    pub qa_id: Option<String>,
    pub change_reason: Option<String>,
    pub qa_note: Option<String>,
}
pub fn issues(conn: &Connection, listing_filter: Option<&str>) -> Result<Vec<Issue>> {
    let mut stmt=conn.prepare("SELECT i.id,i.listing_id,i.field,i.title,c.id,q.id,c.reason,q.note,
        CASE WHEN c.id IS NULL THEN 'detetado'
          WHEN c.listing_revision<>l.revision THEN 'reaberto'
          WHEN q.id IS NULL THEN 'qa_pendente'
          WHEN q.listing_revision<>l.revision THEN 'reaberto'
          WHEN q.result='aprovado' THEN 'resolvido'
          WHEN q.result='falhou' THEN 'reaberto' ELSE 'qa_pendente' END
        FROM issue i JOIN listing l ON l.id=i.listing_id
        LEFT JOIN manual_change c ON c.rowid=(SELECT MAX(c2.rowid) FROM manual_change c2 WHERE c2.issue_id=i.id)
        LEFT JOIN qa_check q ON q.rowid=(SELECT MAX(q2.rowid) FROM qa_check q2 WHERE q2.change_id=c.id)
        WHERE (?1 IS NULL OR i.listing_id=?1) ORDER BY i.rowid DESC")?;
    Ok(stmt
        .query_map([listing_filter], |r| {
            Ok(Issue {
                id: r.get(0)?,
                listing_id: r.get(1)?,
                field: r.get(2)?,
                title: r.get(3)?,
                change_id: r.get(4)?,
                qa_id: r.get(5)?,
                change_reason: r.get(6)?,
                qa_note: r.get(7)?,
                status: r.get(8)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?)
}
pub fn record_change(
    conn: &mut Connection,
    clock: &dyn Clock,
    issue_id: &str,
    edit_location: &str,
    fields: &str,
    reason: &str,
) -> Result<String> {
    if !["ego", "portal"].contains(&edit_location) {
        return Err(invalid("Escolhe EGO ou portal como local da edição."));
    }
    let fields = text(fields, "campos e idiomas alterados", 1000, true)?;
    let reason = text(reason, "motivo e edição realizada", 4000, true)?;
    let tx = conn.transaction()?;
    let listing_id: String = tx
        .query_row(
            "SELECT listing_id FROM issue WHERE id=?1",
            [issue_id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or_else(|| invalid("Problema não encontrado."))?;
    let l = listing(&tx, &listing_id)?;
    if edit_location == "portal" && l.portal_group == "feed_only" {
        return Err(invalid("Este destino recebe os dados do EGO e não se edita no portal. Faz a edição no EGO e regista-a como EGO; o QA fica para depois do ciclo do feed."));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    tx.execute(
        "INSERT INTO manual_change VALUES(?1,?2,?3,?4,?5,?6,?7,?7)",
        params![id, issue_id, l.revision, edit_location, fields, reason, now],
    )?;
    history::record(&tx,clock,Actor::Andreia,NewEvent::new("change",Some(&id),"edicao.manual","Edição manual registada pela Andreia; QA público pendente").payload(serde_json::json!({"issue_id":issue_id,"local":edit_location,"campos":fields,"motivo":reason})))?;
    tx.commit()?;
    Ok(id)
}
pub fn record_qa(
    conn: &mut Connection,
    clock: &dyn Clock,
    change_id: &str,
    result: &str,
    observed_url: &str,
    note: &str,
) -> Result<String> {
    if !["aprovado", "falhou", "nao_verificavel"].contains(&result) {
        return Err(invalid("Resultado de QA inválido."));
    }
    let url = public_url(observed_url, true)?;
    let note = text(note, "evidência ou motivo da verificação", 4000, true)?;
    let tx = conn.transaction()?;
    let (issue_id, revision): (String, i64) = tx
        .query_row(
            "SELECT issue_id,listing_revision FROM manual_change WHERE id=?1",
            [change_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| invalid("Edição não encontrada."))?;
    let current = issues(&tx, None)?
        .into_iter()
        .find(|i| i.id == issue_id)
        .ok_or_else(|| invalid("Problema não encontrado."))?;
    if current.change_id.as_deref() != Some(change_id) {
        return Err(invalid(
            "Existe uma edição mais recente. Valida essa edição.",
        ));
    }
    let l = listing(&tx, &current.listing_id)?;
    if revision != l.revision {
        return Err(invalid(
            "A publicação mudou. Regista uma nova edição ou revisão antes do QA.",
        ));
    }
    if l.url.is_empty() || l.url != url {
        return Err(invalid(
            "A URL observada tem de corresponder à URL pública guardada na publicação.",
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO qa_check VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            id,
            change_id,
            l.revision,
            url,
            result,
            note,
            ts(clock.now())
        ],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "qa",
            Some(&id),
            "qa.registado",
            format!("Verificação pública registada: {result}"),
        )
        .payload(serde_json::json!({"change_id":change_id,"url":url,"nota":note})),
    )?;
    tx.commit()?;
    Ok(id)
}
