//! Imóveis (pela referência EGO) e as suas publicações nos portais.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};

/// Chave conservadora: sem espaços nas pontas, espaços internos únicos,
/// maiúsculas. Zeros à esquerda, hífenes e pontuação mantêm-se.
pub fn reference_key(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").to_uppercase()
}

fn clean(s: &str) -> String {
    s.trim().to_string()
}

fn opt(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn validate_url(u: &str) -> Result<()> {
    let l = u.to_ascii_lowercase();
    if (l.starts_with("https://") || l.starts_with("http://")) && u.len() > 10 && !u.contains(char::is_whitespace) {
        Ok(())
    } else {
        Err(ClaraError::Invalid("o endereço tem de começar por https:// e não pode ter espaços".into()))
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Property {
    pub id: String,
    pub ego_reference: String,
    pub label: String,
    pub ego_url: Option<String>,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub natureza: Option<String>,
    pub concelho: Option<String>,
    pub disponibilidade: Option<String>,
    pub ego_updated_on: Option<String>,
    pub description_original: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PropertySummary {
    #[serde(flatten)]
    pub property: Property,
    pub listings: i64,
    pub open_issues: i64,
    pub qa_pending: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct Listing {
    pub id: String,
    pub property_id: String,
    pub portal_id: String,
    pub portal_name: String,
    pub portal_reference: Option<String>,
    pub public_url: Option<String>,
    pub language: String,
    pub visibility_status: String,
    pub monitoring_enabled: bool,
    pub last_observed_at: Option<String>,
    pub ego_reference: String,
    pub property_label: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ListingInput {
    pub portal_id: String,
    pub portal_reference: Option<String>,
    pub public_url: Option<String>,
    pub language: Option<String>,
    pub visibility_status: Option<String>,
}

fn prop_row(r: &rusqlite::Row) -> rusqlite::Result<Property> {
    Ok(Property {
        id: r.get(0)?,
        ego_reference: r.get(1)?,
        label: r.get(2)?,
        ego_url: r.get(3)?,
        archived: r.get::<_, Option<String>>(4)?.is_some(),
        created_at: r.get(5)?,
        updated_at: r.get(6)?,
        natureza: r.get(7)?,
        concelho: r.get(8)?,
        disponibilidade: r.get(9)?,
        ego_updated_on: r.get(10)?,
        description_original: r.get(11)?,
    })
}

const PROP_COLS: &str = "p.id, p.ego_reference_original, p.label, p.ego_url, p.archived_at, p.created_at, p.updated_at,
    p.natureza, p.concelho, p.disponibilidade, p.ego_updated_on, p.description_original";

pub fn get(conn: &Connection, id: &str) -> Result<Property> {
    conn.query_row(&format!("SELECT {PROP_COLS} FROM property p WHERE p.id = ?1"), [id], prop_row)
        .optional()?
        .ok_or_else(|| ClaraError::NotFound("imóvel".into()))
}

pub fn find_by_ego(conn: &Connection, ego_ref: &str) -> Result<Option<Property>> {
    Ok(conn
        .query_row(&format!("SELECT {PROP_COLS} FROM property p WHERE p.ego_reference_key = ?1"), [reference_key(ego_ref)], prop_row)
        .optional()?)
}

/// Cria um imóvel. Se a referência EGO já existir, devolve o existente
/// (nunca duplica) e indica-o no segundo valor.
pub fn create(conn: &mut Connection, clock: &dyn Clock, ego_ref: &str, label: &str, ego_url: Option<String>) -> Result<(Property, bool)> {
    let original = clean(ego_ref);
    if original.is_empty() {
        return Err(ClaraError::Invalid("indica a referência EGO".into()));
    }
    if let Some(p) = find_by_ego(conn, &original)? {
        return Ok((p, false));
    }
    let ego_url = opt(ego_url);
    if let Some(u) = &ego_url {
        validate_url(u)?;
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO property (id, ego_reference_original, ego_reference_key, label, ego_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![id, original, reference_key(&original), clean(label), ego_url, now],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("property", Some(&id), "imovel.criado", format!("Imóvel criado: {original}")),
    )?;
    tx.commit()?;
    Ok((get(conn, &id)?, true))
}

pub fn update(conn: &mut Connection, clock: &dyn Clock, id: &str, label: &str, ego_url: Option<String>) -> Result<Property> {
    let before = get(conn, id)?;
    let ego_url = opt(ego_url);
    if let Some(u) = &ego_url {
        validate_url(u)?;
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE property SET label = ?1, ego_url = ?2, updated_at = ?3 WHERE id = ?4",
        params![clean(label), ego_url, ts(clock.now()), id],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("property", Some(id), "imovel.editado", format!("Imóvel editado: {}", before.ego_reference))
            .payload(serde_json::json!({"antes": {"label": before.label, "ego_url": before.ego_url}, "depois": {"label": clean(label), "ego_url": ego_url}})),
    )?;
    tx.commit()?;
    get(conn, id)
}

pub fn set_archived(conn: &mut Connection, clock: &dyn Clock, id: &str, archived: bool) -> Result<Property> {
    let before = get(conn, id)?;
    if before.archived == archived {
        return Ok(before);
    }
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE property SET archived_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![if archived { Some(now.clone()) } else { None }, now, id],
    )?;
    let (action, verb) = if archived { ("imovel.arquivado", "arquivado") } else { ("imovel.reativado", "reativado") };
    history::record(&tx, clock, Actor::Andreia, NewEvent::new("property", Some(id), action, format!("Imóvel {verb}: {}", before.ego_reference)))?;
    tx.commit()?;
    get(conn, id)
}

/// Lista imóveis, com pesquisa pela referência EGO, pelo nome ou por
/// qualquer referência de portal associada.
pub fn list(conn: &Connection, query: &str, include_archived: bool) -> Result<Vec<PropertySummary>> {
    let q = format!("%{}%", reference_key(query));
    let sql = format!(
        "SELECT {PROP_COLS},
           (SELECT count(*) FROM listing l WHERE l.property_id = p.id),
           (SELECT count(*) FROM issue i WHERE i.property_id = p.id AND i.resolved_at IS NULL AND i.manual_state IS NOT 'cancelado'),
           (SELECT count(*) FROM change c JOIN listing l ON l.id = c.listing_id WHERE l.property_id = p.id AND c.status = 'qa_pendente')
         FROM property p
         WHERE (?1 = '%%' OR p.ego_reference_key LIKE ?1 OR upper(p.label) LIKE ?1 OR upper(COALESCE(p.concelho, '')) LIKE ?1
                OR EXISTS (SELECT 1 FROM listing l WHERE l.property_id = p.id AND l.portal_reference_key LIKE ?1))
           AND (?2 = 1 OR p.archived_at IS NULL)
         ORDER BY p.archived_at IS NOT NULL, p.updated_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![q, include_archived as i64], |r| {
        Ok(PropertySummary { property: prop_row(r)?, listings: r.get(12)?, open_issues: r.get(13)?, qa_pending: r.get(14)? })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

const LISTING_SELECT: &str = "SELECT l.id, l.property_id, l.portal_id, po.name, l.portal_reference, l.public_url, l.language,
    l.visibility_status, l.monitoring_enabled, l.last_observed_at, p.ego_reference_original, p.label
    FROM listing l JOIN portal po ON po.id = l.portal_id JOIN property p ON p.id = l.property_id";

fn listing_row(r: &rusqlite::Row) -> rusqlite::Result<Listing> {
    Ok(Listing {
        id: r.get(0)?,
        property_id: r.get(1)?,
        portal_id: r.get(2)?,
        portal_name: r.get(3)?,
        portal_reference: r.get(4)?,
        public_url: r.get(5)?,
        language: r.get(6)?,
        visibility_status: r.get(7)?,
        monitoring_enabled: r.get::<_, i64>(8)? == 1,
        last_observed_at: r.get(9)?,
        ego_reference: r.get(10)?,
        property_label: r.get(11)?,
    })
}

pub fn get_listing(conn: &Connection, id: &str) -> Result<Listing> {
    conn.query_row(&format!("{LISTING_SELECT} WHERE l.id = ?1"), [id], listing_row)
        .optional()?
        .ok_or_else(|| ClaraError::NotFound("publicação".into()))
}

pub fn listings_of(conn: &Connection, property_id: &str) -> Result<Vec<Listing>> {
    let mut stmt = conn.prepare(&format!("{LISTING_SELECT} WHERE l.property_id = ?1 ORDER BY po.sort_order, l.language"))?;
    Ok(stmt.query_map([property_id], listing_row)?.collect::<std::result::Result<_, _>>()?)
}

fn validate_listing(conn: &Connection, input: &ListingInput) -> Result<(Option<String>, Option<String>, String, String)> {
    crate::catalog::get(conn, &input.portal_id)?;
    let reference = opt(input.portal_reference.clone());
    let url = opt(input.public_url.clone());
    if let Some(u) = &url {
        validate_url(u)?;
    }
    let lang = opt(input.language.clone()).unwrap_or_else(|| "pt".into()).to_lowercase();
    if lang.len() > 8 {
        return Err(ClaraError::Invalid("idioma inválido".into()));
    }
    let vis = input.visibility_status.clone().unwrap_or_else(|| "desconhecida".into());
    if !["desconhecida", "ativa", "inativa", "retirada"].contains(&vis.as_str()) {
        return Err(ClaraError::Invalid("visibilidade inválida".into()));
    }
    Ok((reference, url, lang, vis))
}

fn map_unique(e: rusqlite::Error) -> ClaraError {
    if e.to_string().contains("UNIQUE") {
        ClaraError::Invalid("já existe uma publicação com esta referência neste portal".into())
    } else {
        ClaraError::Db(e)
    }
}

pub fn add_listing(conn: &mut Connection, clock: &dyn Clock, property_id: &str, input: ListingInput) -> Result<Listing> {
    let prop = get(conn, property_id)?;
    let (reference, url, lang, vis) = validate_listing(conn, &input)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO listing (id, property_id, portal_id, portal_reference, portal_reference_key, public_url, language,
           visibility_status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        params![id, property_id, input.portal_id, reference, reference.as_deref().map(reference_key), url, lang, vis, now],
    )
    .map_err(map_unique)?;
    tx.execute("UPDATE property SET updated_at = ?1 WHERE id = ?2", params![now, property_id])?;
    let portal = crate::catalog::get(&tx, &input.portal_id)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("listing", Some(&id), "publicacao.criada", format!("Publicação criada: {} em {} ({})", prop.ego_reference, portal.name, lang)),
    )?;
    tx.commit()?;
    get_listing(conn, &id)
}

pub fn update_listing(conn: &mut Connection, clock: &dyn Clock, id: &str, input: ListingInput) -> Result<Listing> {
    let before = get_listing(conn, id)?;
    let (reference, url, lang, vis) = validate_listing(conn, &input)?;
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE listing SET portal_id = ?1, portal_reference = ?2, portal_reference_key = ?3, public_url = ?4, language = ?5,
           visibility_status = ?6, updated_at = ?7 WHERE id = ?8",
        params![input.portal_id, reference, reference.as_deref().map(reference_key), url, lang, vis, now, id],
    )
    .map_err(map_unique)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new("listing", Some(id), "publicacao.editada", format!("Publicação editada: {} em {}", before.ego_reference, before.portal_name))
            .payload(serde_json::json!({
                "antes": {"referencia": before.portal_reference, "url": before.public_url, "idioma": before.language, "visibilidade": before.visibility_status},
                "depois": {"referencia": reference, "url": url, "idioma": lang, "visibilidade": vis}
            })),
    )?;
    tx.commit()?;
    get_listing(conn, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SystemClock;

    pub(crate) fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        crate::migrations::migrate(&mut c, &SystemClock).unwrap();
        c
    }

    fn li(portal: &str, r: Option<&str>) -> ListingInput {
        ListingInput {
            portal_id: portal.into(),
            portal_reference: r.map(str::to_string),
            public_url: Some("https://exemplo.test/anuncio".into()),
            language: None,
            visibility_status: None,
        }
    }

    #[test]
    fn ac01_same_ego_reference_never_duplicates_and_keeps_zeros() {
        let mut c = conn();
        let (a, created) = create(&mut c, &SystemClock, "  00123-AB ", "T2 Faro", None).unwrap();
        assert!(created);
        assert_eq!(a.ego_reference, "00123-AB");
        let (b, created2) = create(&mut c, &SystemClock, "00123-ab", "outro", None).unwrap();
        assert!(!created2);
        assert_eq!(a.id, b.id);
        assert!(find_by_ego(&c, "123-AB").unwrap().is_none(), "zeros à esquerda contam");
    }

    #[test]
    fn ac02_search_by_any_portal_reference() {
        let mut c = conn();
        let (p, _) = create(&mut c, &SystemClock, "EGO-1", "Moradia", None).unwrap();
        add_listing(&mut c, &SystemClock, &p.id, li("idealista-pt", Some("ID-777"))).unwrap();
        add_listing(&mut c, &SystemClock, &p.id, li("imovirtual", Some("IMO-555"))).unwrap();
        assert_eq!(list(&c, "imo-555", false).unwrap()[0].property.id, p.id);
        assert_eq!(list(&c, "ID-777", false).unwrap()[0].listings, 2);
        assert!(list(&c, "nada", false).unwrap().is_empty());
        // A mesma referência no mesmo portal é recusada; noutro portal é permitida.
        assert!(add_listing(&mut c, &SystemClock, &p.id, li("idealista-pt", Some("id-777"))).is_err());
        add_listing(&mut c, &SystemClock, &p.id, li("kyero-pt", Some("ID-777"))).unwrap();
    }

    #[test]
    fn ac03_works_with_a_single_property_and_archive_preserves() {
        let mut c = conn();
        let (p, _) = create(&mut c, &SystemClock, "UNICO", "", None).unwrap();
        assert_eq!(list(&c, "", false).unwrap().len(), 1);
        set_archived(&mut c, &SystemClock, &p.id, true).unwrap();
        assert!(list(&c, "", false).unwrap().is_empty());
        assert_eq!(list(&c, "", true).unwrap().len(), 1);
        let (again, created) = create(&mut c, &SystemClock, "unico", "", None).unwrap();
        assert!(!created && again.archived, "reativar não cria outro imóvel");
    }

    #[test]
    fn urls_are_validated() {
        let mut c = conn();
        let (p, _) = create(&mut c, &SystemClock, "X1", "", None).unwrap();
        let mut bad = li("idealista-pt", None);
        bad.public_url = Some("javascript:alert(1)".into());
        assert!(add_listing(&mut c, &SystemClock, &p.id, bad).is_err());
        assert!(create(&mut c, &SystemClock, "X2", "", Some("ftp://x".into())).is_err());
    }
}
