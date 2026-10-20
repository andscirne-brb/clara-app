//! Proposta de levantamento revista pela pessoa; OCR nunca prova ausências.
use crate::{
    ClaraError, Result,
    clock::Clock,
    collection::{Capture, Content},
    ego_import, settings,
};
use calamine::Reader;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path};
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Audit {
    pub reference: String,
    pub captures: Vec<Capture>,
    pub contents: Vec<Content>,
    pub states: BTreeMap<String, String>,
    pub notes: String,
    pub missing_features: String,
    pub reference_confirmed: bool,
    #[serde(default)]
    pub selected_features: Vec<String>,
    #[serde(default)]
    pub feature_list_reviewed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cell {
    pub sheet: String,
    pub column: String,
    pub row: u32,
    pub header: String,
    pub before: String,
    pub after: String,
    pub number: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Prepared {
    pub id: String,
    pub hash: String,
    pub path: String,
    pub reference: String,
    pub date: String,
    pub cells: Vec<Cell>,
    pub source: String,
    pub written: bool,
}
fn invalid(s: &str) -> ClaraError {
    ClaraError::Invalid(s.into())
}
pub fn clean_notes(notes: &str) -> String {
    notes.lines().filter(|line| !["Visita virtual: não aplicável em todos os imóveis, por decisão da responsável pelo levantamento.","Visita virtual: não aplicável ao levantamento."].contains(&line.trim())).collect::<Vec<_>>().join("\n").trim().to_string()
}
pub fn validate(a: &Audit) -> Result<()> {
    if a.reference.trim().is_empty()
        || a.reference.len() > 100
        || a.captures.len() > 30
        || a.contents.len() != 5
        || a.notes.len() > 20000
        || a.missing_features.len() > 10000
    {
        return Err(invalid("Recolha inválida ou demasiado extensa."));
    }
    for cap in &a.captures {
        if cap.name.len() > 300 || cap.text.len() > 150000 {
            return Err(invalid("Captura demasiado extensa."));
        }
    }
    let mut langs = std::collections::BTreeSet::new();
    for c in &a.contents {
        if !["PT", "EN", "FR", "DE", "ES"].contains(&c.language.as_str())
            || !langs.insert(&c.language)
            || c.title.chars().count() > 1000
            || c.description.chars().count() > 32767
        {
            return Err(invalid(
                "Confirma os cinco idiomas e o limite de 32767 caracteres por descrição.",
            ));
        }
    }
    if a.selected_features.len() > 500 || a.selected_features.iter().any(|s| s.len() > 300) {
        return Err(invalid("Lista de características demasiado extensa."));
    }
    let allowed = ["D", "E", "K", "L", "N", "O", "P", "Q", "R", "S"];
    for (k, v) in &a.states {
        if !allowed.contains(&k.as_str())
            || !["Preenchido", "Em falta", "Por verificar", "Não aplicável"].contains(&v.as_str())
        {
            return Err(invalid("Estado do levantamento inválido."));
        }
        if v == "Não aplicável" && clean_notes(&a.notes).is_empty() {
            return Err(invalid(
                "Justifica os campos não aplicáveis nas observações.",
            ));
        }
    }
    if serde_json::to_vec(a)?.len() > 5000000 {
        return Err(invalid(
            "A recolha excede 5 MB de texto. Divide o trabalho.",
        ));
    }
    Ok(())
}
fn key(reference: &str) -> String {
    format!("capture_audit:{}", reference)
}
pub fn draft(c: &Connection, reference: &str) -> Result<Option<Audit>> {
    settings::get(c, &key(reference))?
        .map(|v| serde_json::from_str(&v).map_err(Into::into))
        .transpose()
}
pub fn save(c: &Connection, clock: &dyn Clock, a: &Audit) -> Result<()> {
    validate(a)?;
    settings::put(c, clock, &key(&a.reference), &serde_json::to_string(a)?)
}
pub fn extract(text: &str) -> Option<String> {
    crate::capture_analysis::descriptions(text, "PT")
        .into_iter()
        .max_by_key(|(_, s, partial)| (!partial, s.len()))
        .map(|(_, s, _)| s)
}
pub fn prepare(c: &Connection, clock: &dyn Clock, path: &Path, a: &Audit) -> Result<Prepared> {
    validate(a)?;
    if !a.reference_confirmed || a.captures.is_empty() {
        return Err(invalid(
            "Acrescenta capturas e confirma que pertencem a este imóvel.",
        ));
    }
    let bytes = ego_import::read_file(path)?;
    let mut wb = ego_import::workbook(&bytes)?;
    let main = wb
        .worksheet_range("Levantamento")
        .map_err(|_| invalid("Falta Levantamento."))?;
    let ns = main.start().unwrap_or((0, 0));
    let matches: Vec<_> = main
        .rows()
        .enumerate()
        .filter(|(_, r)| r.first().map(|v| v.to_string()).as_deref() == Some(&a.reference))
        .collect();
    if ns.1 != 0 || matches.len() != 1 {
        return Err(invalid(
            "A referência não existe ou está repetida no levantamento.",
        ));
    }
    let (idx, row) = matches[0];
    let excelrow = ns.0 + idx as u32 + 1;
    if excelrow < 10 {
        return Err(invalid(
            "A referência não corresponde a uma linha de imóvel.",
        ));
    }
    let headers = main
        .rows()
        .find(|r| r.first().map(|v| v.to_string()).as_deref() == Some("Referência EGO"))
        .ok_or_else(|| invalid("Cabeçalhos em falta."))?;
    for (index, name) in [
        (3, "Imagens"),
        (4, "Alt-text"),
        (5, "Descrição PT"),
        (6, "Descrição EN"),
        (7, "Descrição FR"),
        (8, "Descrição DE"),
        (9, "Descrição ES"),
        (10, "Características"),
        (11, "Vídeo"),
        (13, "Planta"),
        (14, "Caderneta Predial (anexo)"),
        (15, "Certificado Energético (anexo)"),
        (16, "Contrato Mediação (anexo)"),
        (17, "Licença Habitação (anexo)"),
        (18, "Folheto"),
        (20, "Campos de características em falta"),
        (21, "Observações / justificação N/A"),
    ] {
        if headers.get(index).map(|v| v.to_string()).as_deref() != Some(name) {
            return Err(invalid(
                "A estrutura das colunas do levantamento mudou. Não foi alterado o Excel.",
            ));
        }
    }
    let mut cells = vec![];
    let mut push = |col: usize, after: String| {
        let before = row.get(col).map(|v| v.to_string()).unwrap_or_default();
        if before != after {
            cells.push(Cell {
                sheet: "Levantamento".into(),
                column: ((b'A' + col as u8) as char).to_string(),
                row: excelrow,
                header: headers.get(col).map(|v| v.to_string()).unwrap_or_default(),
                before,
                after,
                number: false,
            });
        }
    };
    for (k, v) in &a.states {
        if k == "K" && !a.missing_features.trim().is_empty() {
            continue;
        }
        push((k.as_bytes()[0] - b'A') as usize, v.clone());
    }
    for content in a.contents.iter().filter(|x| x.reviewed) {
        let col = match content.language.as_str() {
            "PT" => 5,
            "EN" => 6,
            "FR" => 7,
            "DE" => 8,
            _ => 9,
        };
        push(
            col,
            if content.description.trim().is_empty() {
                "Em falta"
            } else {
                "Preenchido"
            }
            .into(),
        );
    }
    if !a.missing_features.trim().is_empty() {
        push(20, a.missing_features.trim().into());
        push(10, "Em falta".into());
    }
    let date = clock
        .now()
        .with_timezone(&crate::TZ)
        .date_naive()
        .to_string();
    let notes = clean_notes(&a.notes);
    if !notes.trim().is_empty() {
        let old = row.get(21).map(|v| v.to_string()).unwrap_or_default();
        let note = format!("Capturas revistas em {date}: {}", notes.trim());
        if !old.contains(&note) {
            push(21, format!("{}\n{}", old, note).trim().into());
        }
    }
    let source = format!(
        "Capturas eGO revistas: {}",
        a.captures
            .iter()
            .map(|x| x.name.as_str())
            .collect::<Vec<_>>()
            .join("; ")
    );
    if a.contents.iter().any(|x| x.reviewed) {
        let range = wb
            .worksheet_range("Textos por idioma")
            .map_err(|_| invalid("Falta a folha Textos por idioma."))?;
        let start = range.start().unwrap_or((0, 0));
        if start.1 != 0 {
            return Err(invalid("Estrutura de textos alterada."));
        }
        let th = range
            .rows()
            .find(|r| r.first().map(|v| v.to_string()).as_deref() == Some("Referência EGO"))
            .ok_or_else(|| invalid("Cabeçalhos de textos em falta."))?;
        for (index, name) in [
            (1, "Idioma"),
            (2, "Título original"),
            (3, "Descrição original"),
            (4, "Origem / evidência"),
            (5, "Data de recolha"),
            (6, "Estado da recolha"),
        ] {
            if th.get(index).map(|v| v.to_string()).as_deref() != Some(name) {
                return Err(invalid("A estrutura da folha Textos por idioma mudou."));
            }
        }
        for content in a.contents.iter().filter(|x| x.reviewed) {
            let found: Vec<_> = range
                .rows()
                .enumerate()
                .filter(|(_, r)| {
                    r.first().map(|v| v.to_string()).as_deref() == Some(&a.reference)
                        && r.get(1).map(|v| v.to_string()).as_deref() == Some(&content.language)
                })
                .collect();
            if found.len() != 1 {
                return Err(invalid(
                    "Falta uma linha única para o imóvel e idioma na folha de textos.",
                ));
            }
            let (i, r) = found[0];
            let er = start.0 + i as u32 + 1;
            let mut values = vec![
                (3, "Descrição original", content.description.clone()),
                (4, "Origem / evidência", source.clone()),
                (5, "Data de recolha", date.clone()),
                (6, "Estado da recolha", "Revisto".into()),
            ];
            if !content.title.trim().is_empty() {
                values.push((2, "Título original", content.title.clone()));
            }
            for (col, header, after) in values {
                let before = r.get(col).map(|v| v.to_string()).unwrap_or_default();
                let same = if col == 5 {
                    before.parse::<i64>().ok()
                        == Some(
                            (chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").unwrap()
                                - chrono::NaiveDate::from_ymd_opt(1899, 12, 30).unwrap())
                            .num_days(),
                        )
                        || before == after
                } else {
                    before == after
                };
                if !same {
                    cells.push(Cell {
                        sheet: "Textos por idioma".into(),
                        column: ((b'A' + col as u8) as char).to_string(),
                        row: er,
                        header: format!("{} · {}", content.language, header),
                        before,
                        after,
                        number: false,
                    });
                }
            }
        }
    }
    if cells.is_empty() {
        return Err(invalid(
            "Não há campos novos ou revistos para gravar. Os valores existentes foram preservados.",
        ));
    }
    if cells.iter().any(|v| v.after.chars().count() > 32767) {
        return Err(invalid(
            "Um campo excede o limite de texto do Excel. Reduz as observações ou nomes de capturas.",
        ));
    }
    use sha2::{Digest, Sha256};
    let p = Prepared {
        id: uuid::Uuid::new_v4().to_string(),
        hash: hex::encode(Sha256::digest(bytes)),
        path: path.to_string_lossy().into_owned(),
        reference: a.reference.clone(),
        date,
        cells,
        source,
        written: false,
    };
    settings::put(
        c,
        clock,
        &format!("capture_export:{}", p.id),
        &serde_json::to_string(&p)?,
    )?;
    settings::put(
        c,
        clock,
        &format!("capture_version:{}", p.id),
        &serde_json::to_string(a)?,
    )?;
    save(c, clock, a)?;
    Ok(p)
}
pub fn prepared(c: &Connection, id: &str) -> Result<Prepared> {
    uuid::Uuid::parse_str(id).map_err(|_| invalid("Operação inválida."))?;
    serde_json::from_str(
        &settings::get(c, &format!("capture_export:{id}"))?
            .ok_or_else(|| invalid("Pré-visualiza novamente."))?,
    )
    .map_err(Into::into)
}
pub fn mark_written(c: &mut Connection, clock: &dyn Clock, p: &mut Prepared) -> Result<()> {
    if p.written {
        return Ok(());
    }
    p.written = true;
    let tx = c.transaction()?;
    settings::put(
        &tx,
        clock,
        &format!("capture_export:{}", p.id),
        &serde_json::to_string(p)?,
    )?;
    crate::history::record(
        &tx,
        clock,
        crate::history::Actor::Andreia,
        crate::history::NewEvent::new(
            "property",
            Some(&p.reference),
            "levantamento.capturas",
            "Levantamento por capturas gravado no XLSM local; sincronização por confirmar",
        )
        .payload(serde_json::to_value(&p)?),
    )?;
    tx.commit()?;
    Ok(())
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
