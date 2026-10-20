//! Comparação local do levantamento. Uma diferença nunca prova trabalho no eGO.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    ego_import,
    history::{self, Actor, NewEvent},
    settings, weekly,
};
use calamine::Reader;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Change {
    pub reference: String,
    pub field: String,
    pub before: String,
    pub after: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub hash: String,
    pub captured_at: String,
    pub properties: BTreeMap<String, BTreeMap<String, String>>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Review {
    pub token: String,
    pub first_read: bool,
    pub baseline_at: Option<String>,
    pub captured_at: String,
    pub changes: Vec<Change>,
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub file_name: String,
}
#[derive(Serialize, Deserialize)]
struct Pending {
    review: Review,
    snapshot: Snapshot,
    baseline_hash: Option<String>,
}
fn invalid(s: &str) -> ClaraError {
    ClaraError::Invalid(s.into())
}
fn key(path: &Path) -> String {
    format!(
        "workbook_baseline:{}",
        hex::encode(Sha256::digest(path.to_string_lossy().as_bytes()))
    )
}

pub fn read(path: &Path, clock: &dyn Clock) -> Result<Snapshot> {
    let bytes = ego_import::read_file(path)?;
    let mut wb = ego_import::workbook(&bytes)?;
    let range = wb
        .worksheet_range("Levantamento")
        .map_err(|_| invalid("Falta a folha Levantamento."))?;
    // Only source inputs A:X. Calculated states/counts Y:AI are intentionally omitted.
    // Header names are retained, so moving columns does not change their identity.
    let header = range
        .rows()
        .find(|r| r.iter().any(|c| c.to_string() == "Referência EGO"))
        .ok_or_else(|| invalid("Falta o cabeçalho Referência EGO."))?;
    let allowed: BTreeSet<_> = header
        .iter()
        .take(24)
        .map(|c| c.to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if allowed.len() != 24 {
        return Err(invalid(
            "Os cabeçalhos do levantamento mudaram. Confirma a estrutura antes de comparar.",
        ));
    }
    let rows = weekly::rows(range, &["Referência EGO", "Natureza"])?;
    let mut properties = BTreeMap::new();
    for row in rows {
        let reference = row
            .get("Referência EGO")
            .cloned()
            .unwrap_or_default()
            .trim()
            .to_string();
        if reference.is_empty() {
            continue;
        }
        let values = row
            .into_iter()
            .filter(|(h, _)| allowed.contains(h) && h != "Referência EGO")
            .collect();
        if properties.insert(reference, values).is_some() {
            return Err(invalid(
                "Há referências repetidas no levantamento. Corrige-as antes de comparar.",
            ));
        }
    }
    if properties.is_empty() {
        return Err(invalid(
            "O levantamento não tem imóveis. A versão anterior foi preservada.",
        ));
    }
    Ok(Snapshot {
        hash: hex::encode(Sha256::digest(&bytes)),
        captured_at: ts(clock.now()),
        properties,
    })
}
pub fn compare(before: Option<&Snapshot>, after: &Snapshot, file_name: String) -> Review {
    let mut review = Review {
        token: uuid::Uuid::new_v4().to_string(),
        first_read: before.is_none(),
        baseline_at: before.map(|b| b.captured_at.clone()),
        captured_at: after.captured_at.clone(),
        changes: vec![],
        added: vec![],
        removed: vec![],
        file_name,
    };
    if let Some(before) = before {
        for (reference, values) in &after.properties {
            if let Some(old) = before.properties.get(reference) {
                for field in old.keys().chain(values.keys()).collect::<BTreeSet<_>>() {
                    let a = old.get(field).cloned().unwrap_or_default();
                    let b = values.get(field).cloned().unwrap_or_default();
                    if a != b {
                        review.changes.push(Change {
                            reference: reference.clone(),
                            field: field.clone(),
                            before: a,
                            after: b,
                        });
                    }
                }
            } else {
                review.added.push(reference.clone());
            }
        }
        review.removed = before
            .properties
            .keys()
            .filter(|r| !after.properties.contains_key(*r))
            .cloned()
            .collect();
    }
    review
}
pub fn preview(c: &Connection, clock: &dyn Clock, path: &Path) -> Result<Review> {
    let snapshot = read(path, clock)?;
    let baseline: Option<Snapshot> = settings::get(c, &key(path))?
        .map(|s| serde_json::from_str(&s))
        .transpose()?;
    if let Some(old) = &baseline {
        if old
            .properties
            .values()
            .next()
            .map(|v| v.keys().collect::<Vec<_>>())
            != snapshot
                .properties
                .values()
                .next()
                .map(|v| v.keys().collect::<Vec<_>>())
        {
            return Err(invalid(
                "Os campos das primeiras 24 colunas mudaram. Mantém a estrutura do levantamento para comparar; a leitura anterior foi preservada.",
            ));
        }
    }
    let review = compare(
        baseline.as_ref(),
        &snapshot,
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
    );
    let pending = Pending {
        review: review.clone(),
        snapshot,
        baseline_hash: baseline.map(|b| b.hash),
    };
    settings::put(
        c,
        clock,
        &format!("{}_pending", key(path)),
        &serde_json::to_string(&pending)?,
    )?;
    Ok(review)
}
pub fn accept(c: &mut Connection, clock: &dyn Clock, path: &Path, token: &str) -> Result<()> {
    let k = key(path);
    if settings::get(c, &format!("{k}_accepted"))?.as_deref() == Some(token) {
        return Ok(());
    }
    let pending: Pending = serde_json::from_str(
        &settings::get(c, &format!("{k}_pending"))?
            .ok_or_else(|| invalid("Compara novamente o levantamento."))?,
    )?;
    if pending.review.token != token {
        return Err(invalid(
            "A comparação foi substituída. Revê a versão mais recente.",
        ));
    }
    if weekly::fingerprint(path)? != pending.snapshot.hash {
        return Err(invalid(
            "O Excel mudou entretanto. Compara novamente antes de confirmar.",
        ));
    }
    let baseline: Option<Snapshot> = settings::get(c, &k)?
        .map(|s| serde_json::from_str(&s))
        .transpose()?;
    if baseline.map(|b| b.hash) != pending.baseline_hash {
        return Err(invalid("O ponto de comparação mudou. Compara novamente."));
    }
    let tx = c.transaction()?;
    settings::put(&tx, clock, &k, &serde_json::to_string(&pending.snapshot)?)?;
    settings::put(&tx, clock, &format!("{k}_accepted"), token)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "levantamento",
            None,
            "levantamento.comparado",
            if pending.review.first_read {
                "Ponto de partida do levantamento guardado"
            } else {
                "Diferenças do levantamento revistas; não confirma alterações no eGO"
            },
        )
        .payload(serde_json::to_value(&pending.review)?),
    )?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn snapshot(rows: Vec<(&str, Vec<(&str, &str)>)>) -> Snapshot {
        Snapshot {
            hash: "hash".into(),
            captured_at: "data".into(),
            properties: rows
                .into_iter()
                .map(|(r, v)| {
                    (
                        r.into(),
                        v.into_iter().map(|(k, v)| (k.into(), v.into())).collect(),
                    )
                })
                .collect(),
        }
    }
    #[test]
    fn first_read_does_not_invent_history() {
        let s = snapshot(vec![("MO1", vec![("Descrição PT", "Preenchido")])]);
        let r = compare(None, &s, "teste.xlsm".into());
        assert!(r.first_read);
        assert!(r.changes.is_empty());
        assert!(r.added.is_empty());
    }
    #[test]
    fn compare_by_reference_and_keep_before_after() {
        let a = snapshot(vec![
            ("MO1", vec![("Notas", "antes")]),
            ("APT2", vec![("Notas", "igual")]),
        ]);
        let b = snapshot(vec![
            ("APT2", vec![("Notas", "igual")]),
            ("MO1", vec![("Notas", "depois")]),
            ("MO3", vec![]),
        ]);
        let r = compare(Some(&a), &b, "t".into());
        assert_eq!(r.changes.len(), 1);
        assert_eq!(r.changes[0].reference, "MO1");
        assert_eq!(r.changes[0].before, "antes");
        assert_eq!(r.added, vec!["MO3"]);
        assert!(r.removed.is_empty());
        let r = compare(Some(&b), &a, "t".into());
        assert_eq!(r.removed, vec!["MO3"]);
    }
}
