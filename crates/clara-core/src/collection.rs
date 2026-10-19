//! Recolha manual, local e versionada. OCR nunca confirma checkboxes.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    cycle,
    history::{self, Actor, NewEvent},
};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Content {
    pub language: String,
    pub title: String,
    pub description: String,
    pub reviewed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Capture {
    pub name: String,
    pub text: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Collection {
    pub source: String,
    pub contents: Vec<Content>,
    pub captures: Vec<Capture>,
    /// Opções que a pessoa confirmou visualmente, uma por linha.
    pub selected_features: Vec<String>,
    pub feature_list_reviewed: bool,
    pub notes: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub collected_at: String,
    pub data: Collection,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Suggestion {
    pub field: String,
    pub evidence: String,
    pub state: String,
}
fn norm(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' => 'a',
            'é' | 'ê' => 'e',
            'í' => 'i',
            'ó' | 'ô' | 'õ' => 'o',
            'ú' => 'u',
            'ç' => 'c',
            x => x,
        })
        .collect()
}
pub fn suggestions(data: &Collection) -> Vec<Suggestion> {
    let mut found = vec![];
    // Só texto PT revisto. Traduções e OCR bruto não são fontes confirmadas.
    for content in data
        .contents
        .iter()
        .filter(|c| c.language == "PT" && c.reviewed)
    {
        for sentence in content.description.split(['.', '!', '?', '\n']) {
            let s = norm(sentence);
            if [
                "potencial",
                "possibil",
                "pode",
                "podera",
                "projeto",
                "projecto",
                " nao ",
                " sem ",
                "futur",
            ]
            .iter()
            .any(|w| format!(" {s} ").contains(w))
            {
                continue;
            }
            for (field, terms) in [
                (
                    "Cozinha Equipada",
                    vec![
                        "cozinha totalmente equipada",
                        "cozinha equipada",
                        "cozinha completamente equipada",
                    ],
                ),
                ("Roupeiros embutidos", vec!["roupeiros embutidos"]),
                ("Lareira", vec!["lareira"]),
                ("Lavandaria", vec!["lavandaria"]),
                ("Varandas", vec!["varandas", "varanda"]),
                ("Arrecadação", vec!["arrecadacoes", "arrecadacao"]),
                ("Aeroporto", vec!["aeroporto"]),
                ("Auto-Estrada", vec!["a22", "autoestrada", "auto-estrada"]),
                ("Praia", vec!["praia"]),
                ("Campo de Golfe", vec!["campo de golfe", "campos de golfe"]),
                ("Jardim", vec!["jardim", "jardins"]),
                ("Terraço", vec!["terraco"]),
            ] {
                if terms.iter().any(|t| s.contains(t))
                    && !found.iter().any(|x: &Suggestion| x.field == field)
                {
                    let selected = data
                        .selected_features
                        .iter()
                        .any(|x| norm(x.trim()) == norm(field));
                    found.push(Suggestion {
                        field: field.into(),
                        evidence: sentence.trim().into(),
                        state: if selected {
                            "Assinalado: conferir quantidade, se aplicável"
                        } else if data.feature_list_reviewed {
                            "Diferença a confirmar"
                        } else {
                            "Conferir na ficha"
                        }
                        .into(),
                    });
                }
            }
        }
    }
    found
}
pub fn save(
    conn: &mut Connection,
    clock: &dyn Clock,
    property_id: &str,
    data: Collection,
) -> Result<Snapshot> {
    cycle::get_property(conn, property_id)?;
    if data.source.trim().is_empty()
        || data.source.len() > 500
        || data.notes.len() > 20000
        || data.captures.len() > 30
        || data.contents.len() != 5
        || data.selected_features.len() > 300
    {
        return Err(ClaraError::Invalid(
            "Recolha incompleta ou demasiado grande.".into(),
        ));
    }
    let mut languages = std::collections::HashSet::new();
    for c in &data.contents {
        if !["PT", "EN", "FR", "DE", "ES"].contains(&c.language.as_str())
            || !languages.insert(c.language.clone())
            || c.title.len() > 2000
            || c.description.len() > 40000
        {
            return Err(ClaraError::Invalid(
                "Confirma os cinco idiomas e o tamanho dos textos.".into(),
            ));
        }
    }
    if data
        .captures
        .iter()
        .any(|c| c.name.len() > 500 || c.text.len() > 150000)
        || data.selected_features.iter().any(|s| s.len() > 200)
    {
        return Err(ClaraError::Invalid(
            "Captura ou característica demasiado extensa.".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let collected_at = ts(clock.now());
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO collection_snapshot(id,property_id,collected_at,payload) VALUES(?1,?2,?3,?4)",
        params![id, property_id, collected_at, serde_json::to_string(&data)?],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(property_id),
            "recolha.guardada",
            "Versão da recolha manual guardada",
        ),
    )?;
    tx.commit()?;
    Ok(Snapshot {
        id,
        collected_at,
        data,
    })
}
pub fn list(conn: &Connection, property_id: &str) -> Result<Vec<Snapshot>> {
    cycle::get_property(conn, property_id)?;
    let mut stmt=conn.prepare("SELECT id,collected_at,payload FROM collection_snapshot WHERE property_id=?1 ORDER BY collected_at DESC,rowid DESC")?;
    let rows = stmt.query_map([property_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })?;
    rows.map(|r| {
        let (id, collected_at, payload) = r?;
        Ok(Snapshot {
            id,
            collected_at,
            data: serde_json::from_str(&payload)?,
        })
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> Collection {
        Collection {
            source: "EGO TESTE".into(),
            contents: ["PT", "EN", "FR", "DE", "ES"]
                .iter()
                .map(|l| Content {
                    language: l.to_string(),
                    title: String::new(),
                    description: String::new(),
                    reviewed: false,
                })
                .collect(),
            captures: vec![],
            selected_features: vec![],
            feature_list_reviewed: false,
            notes: String::new(),
        }
    }
    #[test]
    fn excludes_potential_negation_and_unreviewed() {
        let mut d = sample();
        d.contents[0].description = "Cozinha equipada. Sem lareira. Potencial para jardim.".into();
        assert!(suggestions(&d).is_empty());
        d.contents[0].reviewed = true;
        let s = suggestions(&d);
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].field, "Cozinha Equipada");
        assert_eq!(s[0].state, "Conferir na ficha");
    }
    #[test]
    fn comparison_requires_visual_review_and_keeps_evidence() {
        let mut d = sample();
        d.contents[0].reviewed = true;
        d.contents[0].description = "Cinco varandas e duas arrecadações.".into();
        d.feature_list_reviewed = true;
        d.selected_features = vec!["Varandas".into()];
        let s = suggestions(&d);
        assert_eq!(s.len(), 2);
        assert!(s[0].state.starts_with("Assinalado"));
        assert_eq!(s[1].state, "Diferença a confirmar");
        assert!(s[1].evidence.contains("duas"));
    }
}
