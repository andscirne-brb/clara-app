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
    collections::{HashMap, HashSet},
    path::Path,
};
pub const PATH_KEY: &str = "weekly_workbook_path";
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
    let mut checked = vec![];
    let mut done = vec![];
    let mut sara = vec![];
    let mut other = vec![];
    let mut resolved = vec![];
    let mut seen = HashSet::new();
    for r in &main {
        let reference = get(r, "Referência EGO");
        if !reference.is_empty() && in_period(get(r, "Data da verificação"), from, to) {
            checked.push(format!(
                "- {} — {}.",
                line(reference),
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
        let author = get(r, "Autor");
        let location = get(r, "Onde foi alterado");
        let result = get(r, "Resultado da verificação");
        done.push(format!(
            "- {} — {}. Local: {}. Autor: {}. Verificação: {}.",
            line(reference),
            line(after),
            if location.is_empty() {
                "por indicar".into()
            } else {
                line(location)
            },
            if author.is_empty() {
                "por indicar".into()
            } else {
                line(author)
            },
            if result.is_empty() {
                "por verificar".into()
            } else {
                line(result)
            }
        ));
    }
    for r in &issues {
        let reference = get(r, "Referência EGO");
        if reference.is_empty() {
            continue;
        }
        let id = get(r, "ID");
        if id.is_empty() || !seen.insert(id.to_string()) {
            warnings.push(format!(
                "Pendência sem ID ou com ID repetido: {} / {}.",
                line(reference),
                line(id)
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
                resolved.push(format!(
                    "- {} / {} — {}. {}",
                    line(reference),
                    line(id),
                    line(subject),
                    line(decision)
                ));
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
                line(id)
            ));
        }
        let action = get(r, "Ação necessária");
        let who = get(r, "Aguarda análise de");
        let owner = get(r, "Responsável");
        let entry = format!(
            "- {} / {} — {}. {} Estado: {}. Responsável: {}. Aguarda análise de: {}.",
            line(reference),
            line(id),
            line(subject),
            line(action),
            if state.is_empty() {
                "por definir".into()
            } else {
                line(state)
            },
            if owner.is_empty() {
                "por atribuir".into()
            } else {
                line(owner)
            },
            if who.is_empty() {
                "por definir".into()
            } else {
                line(who)
            }
        );
        if ["sara", "sara e júlia"].contains(&who.to_lowercase().as_str()) {
            sara.push(entry)
        } else {
            other.push(entry)
        }
    }
    let mut body = format!(
        "Assunto: Levantamento de imóveis | {} a {}\n\nOlá Sara e Júlia,\n\nPartilho o resumo do levantamento de imóveis entre {} e {}.\n",
        from.format("%d/%m/%Y"),
        to.format("%d/%m/%Y"),
        from.format("%d/%m/%Y"),
        to.format("%d/%m/%Y")
    );
    for (title, entries, empty) in [
        (
            "Verificações registadas no período",
            checked,
            "- Sem verificações datadas neste período.",
        ),
        (
            "Alterações realizadas e registadas",
            done,
            "- Sem alterações registadas neste período; isto não confirma ausência de trabalho realizado.",
        ),
        (
            "Pendências concluídas no período",
            resolved,
            "- Sem conclusões confirmadas neste período.",
        ),
        (
            "Pontos que aguardam análise da Sara",
            sara,
            "- Nenhum assunto identificado neste campo como aguardando análise da Sara.",
        ),
        (
            "Outras pendências e próximos passos",
            other,
            "- Sem outras pendências registadas.",
        ),
    ] {
        body.push_str(&format!(
            "\n{title}\n{}\n",
            if entries.is_empty() {
                empty.into()
            } else {
                entries.join("\n")
            }
        ));
    }
    if !warnings.is_empty() {
        body.push_str("\nRegistos a esclarecer\n");
        for w in &warnings {
            body.push_str(&format!("- {w}\n"));
        }
    }
    body.push_str("\nAs pendências refletem o estado atual do ficheiro, incluindo assuntos de semanas anteriores. O resumo usa as datas registadas; campos sem hora não permitem distinguir alterações antes ou depois das 20h15.\n\nObrigada,\nAndreia");
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
        "SELECT payload FROM weekly_report ORDER BY generated_at DESC,rowid DESC LIMIT 20",
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
