//! Resumos determinísticos do XLSM principal. Só lê valores/caches, nunca macros.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    ego_import,
    history::{self, Actor, NewEvent},
};
use calamine::{Data, DataType, Reader};
use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
};
pub const PATH_KEY: &str = "weekly_workbook_path";
pub fn fingerprint(path: &Path) -> Result<String> {
    Ok(hex::encode(Sha256::digest(ego_import::read_file(path)?)))
}
#[derive(Clone, Debug, Serialize)]
pub struct TrackerProperty {
    pub reference: String,
    pub nature: String,
    pub municipality: String,
    pub state: String,
    pub pending: Vec<String>,
}
pub fn tracker(path: &Path, clock: &dyn Clock) -> Result<Vec<TrackerProperty>> {
    let today = clock.now().with_timezone(&crate::TZ).date_naive();
    let report = build(
        path,
        &(today - Duration::days(365)).to_string(),
        &today.to_string(),
        clock,
    )?;
    let pending: HashMap<_, _> = report
        .properties
        .into_iter()
        .map(|p| (p.reference, p.pending))
        .collect();
    let bytes = ego_import::read_file(path)?;
    let mut wb = ego_import::workbook(&bytes)?;
    let data = rows(
        wb.worksheet_range("Levantamento")
            .map_err(|_| invalid("Falta a folha Levantamento."))?,
        &["Referência EGO", "Natureza", "Estado da verificação"],
    )?;
    let mut result: Vec<_> = data
        .into_iter()
        .filter(|r| !get(r, "Referência EGO").is_empty())
        .map(|r| {
            let reference = get(&r, "Referência EGO").to_string();
            TrackerProperty {
                pending: pending.get(&reference).cloned().unwrap_or_default(),
                reference,
                nature: get(&r, "Natureza").into(),
                municipality: get(&r, "Concelho").into(),
                state: get(&r, "Estado da verificação").into(),
            }
        })
        .collect();
    result.sort_by_key(|r| {
        (
            !r.nature.to_lowercase().contains("moradia")
                && !r.nature.to_lowercase().contains("apartamento"),
            r.reference.clone(),
        )
    });
    Ok(result)
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Report {
    pub id: String,
    pub generated_at: String,
    pub start: String,
    pub end: String,
    pub file_name: String,
    pub source_hash: String,
    pub body: String,
    pub warnings: Vec<String>,
    #[serde(default)]
    pub properties: Vec<PropertySummary>,
    #[serde(default)]
    pub intro: String,
    #[serde(default)]
    pub closing: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct PropertySummary {
    pub reference: String,
    pub work: Vec<String>,
    pub pending: Vec<String>,
}
type Row = HashMap<String, String>;
fn invalid(s: &str) -> ClaraError {
    ClaraError::Invalid(s.into())
}
fn text(d: &Data) -> String {
    match d {
        Data::Empty => String::new(),
        Data::DateTime(d) => d
            .as_datetime()
            .map(|v| v.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_default(),
        _ => d.to_string(),
    }
}
fn rows(range: calamine::Range<Data>, required: &[&str]) -> Result<Vec<Row>> {
    let mut all = range.rows();
    let header=all.find(|r|required.iter().all(|h|r.iter().any(|c|text(c)==*h))).ok_or_else(||invalid("O ficheiro não tem os cabeçalhos esperados. Usa o levantamento principal atualizado."))?;
    let headers: Vec<String> = header.iter().map(text).collect();
    let mut out = vec![];
    for row in all {
        if row.iter().all(|c| matches!(c, Data::Empty)) {
            continue;
        }
        if out.len() >= 15000 {
            return Err(invalid("A folha excede 15 000 linhas."));
        }
        if row.iter().any(|c| matches!(c, Data::Error(_))) {
            return Err(invalid(
                "Há erros Excel no ficheiro. Recalcula e guarda antes de gerar o resumo.",
            ));
        }
        let mapped = headers
            .iter()
            .enumerate()
            .map(|(i, h)| (h.clone(), row.get(i).map(text).unwrap_or_default()))
            .collect();
        out.push(mapped);
    }
    Ok(out)
}
fn get<'a>(r: &'a Row, k: &str) -> &'a str {
    r.get(k).map(|s| s.trim()).unwrap_or("")
}
fn date(s: &str) -> Option<NaiveDate> {
    if let Ok(number) = s.parse::<f64>() {
        if number.is_finite() && (1.0..100000.0).contains(&number) {
            return NaiveDate::from_ymd_opt(1899, 12, 30)?
                .checked_add_signed(Duration::days(number.floor() as i64));
        }
    }
    for fmt in ["%Y-%m-%d", "%d/%m/%Y"] {
        if let Ok(d) = NaiveDate::parse_from_str(s.get(..10).unwrap_or(s), fmt) {
            return Some(d);
        }
    }
    None
}
fn line(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}
fn in_period(s: &str, start: NaiveDate, end: NaiveDate) -> bool {
    date(s).map(|d| d >= start && d <= end).unwrap_or(false)
}
pub fn default_period(today: NaiveDate) -> (NaiveDate, NaiveDate) {
    let days = (today.weekday().num_days_from_monday() + 2) % 7;
    (today - Duration::days(days as i64), today)
}
pub fn build(path: &Path, start: &str, end: &str, clock: &dyn Clock) -> Result<Report> {
    if !matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "xlsm" | "xlsx"
    ) {
        return Err(invalid("Escolhe o XLSM principal ou uma cópia XLSX."));
    }
    let from = NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .map_err(|_| invalid("Data inicial inválida."))?;
    let to =
        NaiveDate::parse_from_str(end, "%Y-%m-%d").map_err(|_| invalid("Data final inválida."))?;
    let today = clock.now().with_timezone(&crate::TZ).date_naive();
    if from > to || to > today || (to - from).num_days() > 366 {
        return Err(invalid(
            "Escolhe um período válido, até hoje e com no máximo um ano.",
        ));
    }
    let bytes = ego_import::read_file(path)?;
    let mut wb = ego_import::workbook(&bytes)?;
    let main = rows(
        wb.worksheet_range("Levantamento")
            .map_err(|_| invalid("Falta a folha Levantamento."))?,
        &[
            "Referência EGO",
            "Data da verificação",
            "Estado da verificação",
        ],
    )?;
    let issues = rows(
        wb.worksheet_range("Pendências da equipa")
            .map_err(|_| invalid("Falta a folha Pendências da equipa."))?,
        &[
            "ID",
            "Referência EGO",
            "Assunto",
            "Estado",
            "Aguarda análise de",
        ],
    )?;
    let changes = rows(
        wb.worksheet_range("Registo de alterações")
            .map_err(|_| invalid("Falta a folha Registo de alterações."))?,
        &[
            "Data da alteração",
            "Referência EGO",
            "Autor",
            "Depois / alteração realizada",
        ],
    )?;
    let known: HashSet<String> = main
        .iter()
        .filter_map(|r| {
            let v = get(r, "Referência EGO");
            (!v.is_empty()).then(|| v.to_string())
        })
        .collect();
    let mut warnings = vec![];
    let mut grouped: BTreeMap<String, PropertySummary> = BTreeMap::new();
    let mut seen = HashSet::new();
    for r in &main {
        let reference = get(r, "Referência EGO");
        if !reference.is_empty() && in_period(get(r, "Data da verificação"), from, to) {
            grouped
                .entry(reference.into())
                .or_default()
                .work
                .push(format!(
                    "Verificação registada: {}.",
                    line(get(r, "Estado da verificação"))
                ));
        }
    }
    for r in &changes {
        let reference = get(r, "Referência EGO");
        if reference.is_empty() {
            continue;
        }
        let d = get(r, "Data da alteração");
        if date(d).is_none() {
            warnings.push(format!(
                "Alteração sem data válida: {} / {}.",
                line(reference),
                line(get(r, "Campo / assunto"))
            ));
            continue;
        }
        if !in_period(d, from, to) {
            continue;
        }
        if !known.contains(reference) {
            warnings.push(format!(
                "Alteração com referência fora do levantamento: {}.",
                line(reference)
            ));
        }
        let after = get(r, "Depois / alteração realizada");
        if after.is_empty() {
            warnings.push(format!(
                "Alteração sem descrição do que foi feito: {}.",
                line(reference)
            ));
            continue;
        }
        let location = get(r, "Onde foi alterado");
        let result = get(r, "Resultado da verificação");
        let mut entry = line(after);
        if !location.is_empty() && location != "eGO" {
            entry.push_str(&format!(" ({}).", line(location)));
        }
        // Keep material verification failures visible, without repeating routine metadata.
        if result.is_empty()
            || (!result.starts_with("Realizado pela autora") && result != "Confirmado")
        {
            entry.push_str(&format!(
                " Verificação: {}.",
                if result.is_empty() {
                    "por verificar".into()
                } else {
                    line(result)
                }
            ));
        }
        grouped
            .entry(reference.into())
            .or_default()
            .work
            .push(entry);
    }
    for r in &issues {
        let reference = get(r, "Referência EGO");
        if reference.is_empty() {
            continue;
        }
        let id = get(r, "ID");
        if id.is_empty() || !seen.insert(id.to_string()) {
            warnings.push(format!(
                "Pendência com identificação em falta ou repetida: {} — {}.",
                line(reference),
                line(get(r, "Assunto"))
            ));
        }
        let state = get(r, "Estado");
        let subject = get(r, "Assunto");
        let decision = get(r, "Resposta / decisão");
        let closed = state == "Concluído"
            && date(get(r, "Data de resolução")).is_some()
            && !decision.is_empty()
            && get(r, "Verificação final") == "Confirmado";
        if closed {
            if in_period(get(r, "Data de resolução"), from, to) {
                grouped
                    .entry(reference.into())
                    .or_default()
                    .work
                    .push(format!("Concluído: {}. {}", line(subject), line(decision)));
            }
            continue;
        }
        if state == "Não aplicável" && !decision.is_empty() {
            continue;
        }
        if state == "Concluído" {
            warnings.push(format!(
                "Conclusão por validar: {} / {}.",
                line(reference),
                line(subject)
            ));
        }
        let action = get(r, "Ação necessária");
        let entry = format!(
            "{}. {} Estado: {}.",
            line(subject),
            line(action),
            if state.is_empty() {
                "por definir".into()
            } else {
                line(state)
            }
        );
        grouped
            .entry(reference.into())
            .or_default()
            .pending
            .push(entry);
    }
    let intro = format!(
        "Assunto: Levantamento de imóveis | {} a {}\n\nOlá Sara,\n\nPartilho o resumo do levantamento de imóveis entre {} e {}.\n",
        from.format("%d/%m/%Y"),
        to.format("%d/%m/%Y"),
        from.format("%d/%m/%Y"),
        to.format("%d/%m/%Y")
    );
    let properties: Vec<PropertySummary> = grouped
        .into_iter()
        .map(|(reference, mut p)| {
            p.reference = reference;
            p
        })
        .collect();
    let mut body = intro.clone();
    if properties.is_empty() {
        body.push_str("\nSem verificações, alterações ou pendências registadas para apresentar.\n");
    }
    for p in &properties {
        body.push_str(&format!(
            "\n{}\nTrabalho realizado / verificação:\n{}\nPendentes / análise da Sara:\n{}\n",
            p.reference,
            if p.work.is_empty() {
                "- Sem trabalho datado neste período.".into()
            } else {
                p.work
                    .iter()
                    .map(|s| format!("- {s}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            },
            if p.pending.is_empty() {
                "- Sem pendências registadas.".into()
            } else {
                p.pending
                    .iter()
                    .map(|s| format!("- {s}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        ));
    }
    let mut closing = String::new();
    if !warnings.is_empty() {
        closing.push_str("\nRegistos a esclarecer\n");
        for w in &warnings {
            closing.push_str(&format!("- {w}\n"));
        }
    }
    closing.push_str("\nTrabalhos registados pela autora; detalhes e verificações disponíveis no Excel. As pendências refletem o estado atual do ficheiro, incluindo semanas anteriores. A ausência de registo datado não confirma ausência de trabalho. O resumo usa as datas registadas, sem distinguir horas.\n\nObrigada,\nAndreia");
    body.push_str(&closing);
    Ok(Report {
        id: uuid::Uuid::new_v4().to_string(),
        generated_at: ts(clock.now()),
        start: start.into(),
        end: end.into(),
        file_name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        source_hash: hex::encode(Sha256::digest(&bytes)),
        body,
        warnings,
        properties,
        intro,
        closing,
    })
}
pub fn save(conn: &mut Connection, clock: &dyn Clock, report: &Report) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO weekly_report(id,generated_at,payload) VALUES(?1,?2,?3)",
        params![
            report.id,
            report.generated_at,
            serde_json::to_string(report)?
        ],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "resumo",
            Some(&report.id),
            "resumo.gerado",
            "Resumo semanal local gerado",
        ),
    )?;
    tx.commit()?;
    Ok(())
}
pub fn recent(conn: &Connection) -> Result<Vec<Report>> {
    let mut s = conn.prepare(
        "SELECT payload FROM weekly_report ORDER BY generated_at DESC,rowid DESC LIMIT 260",
    )?;
    let rows = s.query_map([], |r| r.get::<_, String>(0))?;
    rows.map(|r| Ok(serde_json::from_str(&r?)?)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn week_and_dates() {
        assert_eq!(date("46314"), NaiveDate::from_ymd_opt(2026, 10, 19));
        assert!(date("texto").is_none());
        let (s, e) = default_period(NaiveDate::from_ymd_opt(2026, 10, 23).unwrap());
        assert_eq!(s.to_string(), "2026-10-17");
        assert_eq!(e.to_string(), "2026-10-23");
    }
}
