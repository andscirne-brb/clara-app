//! Levantamento manual dos três perfis. Sem rede ou credenciais.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    history::{self, Actor, NewEvent},
    settings,
};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Text {
    pub language: String,
    pub original: String,
    pub proposed: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Item {
    pub field: String,
    pub state: String,
    pub note: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    pub portal: String,
    pub url: String,
    pub stage: String,
    pub source: String,
    pub next_action: String,
    pub sara: String,
    pub applied_date: String,
    pub applied_confirmed: bool,
    pub texts: Vec<Text>,
    pub items: Vec<Item>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Version {
    pub id: String,
    pub saved_at: String,
    pub data: Profile,
}
pub const FIELDS: [&str; 5] = [
    "empresa",
    "contactos",
    "imagens",
    "apresentacao",
    "ligacoes",
];
fn portal(p: &str) -> Result<()> {
    if ["idealista", "green-acres", "rightmove"].contains(&p) {
        Ok(())
    } else {
        Err(ClaraError::Invalid(
            "Escolhe um dos três portais de trabalho.".into(),
        ))
    }
}
pub fn validate(p: &Profile, clock: &dyn Clock, final_save: bool) -> Result<()> {
    portal(&p.portal)?;
    if ![
        "Por iniciar",
        "Em curso",
        "A aguardar Sara",
        "Aplicado e conferido",
    ]
    .contains(&p.stage.as_str())
    {
        return Err(ClaraError::Invalid("Estado do perfil inválido.".into()));
    }
    for s in [&p.url, &p.source, &p.next_action, &p.sara] {
        if s.chars().count() > 4000 {
            return Err(ClaraError::Invalid("Texto demasiado longo.".into()));
        }
    }
    if !p.url.is_empty() {
        match url::Url::parse(&p.url) {
            Ok(u)
                if u.scheme() == "https"
                    && u.host_str().is_some()
                    && u.username().is_empty()
                    && u.password().is_none() => {}
            Err(_) if !final_save && !p.url.contains('@') => {}
            _ => {
                return Err(ClaraError::Invalid(
                    "Usa uma ligação HTTPS válida para o perfil público, sem credenciais.".into(),
                ));
            }
        }
    }
    let mut langs = std::collections::HashSet::new();
    if p.texts.len() != 5 {
        return Err(ClaraError::Invalid("Faltam idiomas no perfil.".into()));
    }
    for t in &p.texts {
        if !["PT", "EN", "FR", "ES", "DE"].contains(&t.language.as_str())
            || !langs.insert(&t.language)
            || t.original.chars().count() > 32767
            || t.proposed.chars().count() > 32767
        {
            return Err(ClaraError::Invalid(
                "Idioma repetido ou texto inválido.".into(),
            ));
        }
    }
    let mut fields = std::collections::HashSet::new();
    if p.items.len() != FIELDS.len() {
        return Err(ClaraError::Invalid(
            "Faltam assuntos do levantamento.".into(),
        ));
    }
    for i in &p.items {
        if !FIELDS.contains(&i.field.as_str())
            || !fields.insert(&i.field)
            || !["Por verificar", "Ajustar", "Conferido", "Não aplicável"]
                .contains(&i.state.as_str())
            || i.note.chars().count() > 4000
        {
            return Err(ClaraError::Invalid("Assunto ou estado inválido.".into()));
        }
    }
    if final_save && p.stage == "Aplicado e conferido" {
        let date =
            chrono::NaiveDate::parse_from_str(&p.applied_date, "%Y-%m-%d").map_err(|_| {
                ClaraError::Invalid("Indica a data em que conferiste o perfil publicado.".into())
            })?;
        if !p.applied_confirmed
            || p.url.is_empty()
            || date > clock.now().with_timezone(&crate::TZ).date_naive()
            || p.items.iter().any(|i| {
                i.state != "Conferido" && (i.state != "Não aplicável" || i.note.trim().is_empty())
            })
        {
            return Err(ClaraError::Invalid("Para concluir, confere todos os assuntos, justifica os não aplicáveis e confirma a publicação, a ligação e a data.".into()));
        }
    }
    Ok(())
}
pub fn draft(conn: &Connection, p: &str) -> Result<Option<Profile>> {
    portal(p)?;
    settings::get(conn, &format!("company_profile_draft:{p}"))?
        .map(|s| serde_json::from_str(&s).map_err(Into::into))
        .transpose()
}
pub fn draft_save(conn: &Connection, clock: &dyn Clock, p: &Profile) -> Result<()> {
    validate(p, clock, false)?;
    settings::put(
        conn,
        clock,
        &format!("company_profile_draft:{}", p.portal),
        &serde_json::to_string(p)?,
    )?;
    Ok(())
}
pub fn versions(conn: &Connection, p: &str) -> Result<Vec<Version>> {
    Ok(versions_for_excel(conn, p)?.into_iter().take(30).collect())
}
pub fn versions_for_excel(conn: &Connection, p: &str) -> Result<Vec<Version>> {
    portal(p)?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_setting WHERE key LIKE ?1 ORDER BY key DESC LIMIT 15001")?;
    let strings = stmt
        .query_map([format!("company_profile_version:{p}:%")], |r| {
            r.get::<_, String>(0)
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    if strings.len() > 15000 {
        return Err(ClaraError::Invalid(
            "O histórico dos perfis excede o limite de exportação.".into(),
        ));
    }
    strings
        .into_iter()
        .map(|s| serde_json::from_str(&s).map_err(Into::into))
        .collect()
}
pub fn save(conn: &mut Connection, clock: &dyn Clock, p: Profile) -> Result<Version> {
    validate(&p, clock, true)?;
    if let Some(old) = versions(conn, &p.portal)?.first() {
        if old.data == p {
            return Ok(old.clone());
        }
    }
    let v = Version {
        id: uuid::Uuid::new_v4().to_string(),
        saved_at: ts(clock.now()),
        data: p,
    };
    let tx = conn.transaction()?;
    let counter_key = format!("company_profile_counter:{}", v.data.portal);
    let counter = settings::get(&tx, &counter_key)?
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| ClaraError::Invalid("Limite de versões atingido.".into()))?;
    settings::put(&tx, clock, &counter_key, &counter.to_string())?;
    settings::put(
        &tx,
        clock,
        &format!("company_profile_version:{}:{counter:020}", v.data.portal),
        &serde_json::to_string(&v)?,
    )?;
    settings::put(
        &tx,
        clock,
        &format!("company_profile_draft:{}", v.data.portal),
        &serde_json::to_string(&v.data)?,
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "perfil_empresa",
            Some(&v.data.portal),
            "perfil.registado",
            format!("Perfil {}: {}", v.data.portal, v.data.stage),
        )
        .payload(serde_json::to_value(&v)?),
    )?;
    tx.commit()?;
    Ok(v)
}
