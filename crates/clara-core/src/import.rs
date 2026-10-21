//! Importação da listagem de imóveis exportada do EGO (.xlsx, .xlsm, .xls).
//!
//! Lê só os valores das células: nunca corre macros nem recalcula fórmulas.
//! Fluxo: ler → pré-visualizar diferenças → confirmar → aplicar numa
//! transação. Repetir o mesmo ficheiro não altera nada. Um imóvel que deixe
//! de aparecer no ficheiro não é apagado.

use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::Path;

use crate::clock::{ts, Clock};
use crate::error::{ClaraError, Result};
use crate::history::{self, Actor, NewEvent};
use crate::property::reference_key;

const MAX_BYTES: u64 = 50 * 1024 * 1024;
const MAX_ROWS: usize = 20_000;

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
pub struct EgoRow {
    pub line: usize,
    pub reference: String,
    pub natureza: Option<String>,
    pub disponibilidade: Option<String>,
    pub concelho: Option<String>,
    pub created_on: Option<String>,
    pub updated_on: Option<String>,
    #[serde(skip)]
    pub description: Option<String>,
    pub has_description: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct RowProblem {
    pub line: usize,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ParsedFile {
    pub file_name: String,
    pub sha256: String,
    pub sheet: String,
    pub columns_found: Vec<String>,
    pub columns_missing: Vec<String>,
    pub rows: Vec<EgoRow>,
    pub problems: Vec<RowProblem>,
}

fn norm(s: &str) -> String {
    let lower = s.trim().to_lowercase();
    let mut out = String::new();
    for c in lower.chars() {
        let c = match c {
            'á' | 'à' | 'â' | 'ã' => 'a',
            'é' | 'ê' => 'e',
            'í' => 'i',
            'ó' | 'ô' | 'õ' => 'o',
            'ú' => 'u',
            'ç' => 'c',
            other => other,
        };
        if c.is_alphanumeric() {
            out.push(c);
        }
    }
    out
}

/// Colunas reconhecidas (nome normalizado → campo).
const COLUMNS: [(&str, &str); 7] = [
    ("referencia", "Referência"),
    ("natureza", "Natureza"),
    ("disponibilidade", "Disponibilidade"),
    ("concelho", "Concelho"),
    ("datadecriacao", "Data de criação"),
    ("datadealteracao", "Data de alteração"),
    ("descricao", "Descrição"),
];

fn cell_text(d: &Data) -> Option<String> {
    let s = match d {
        Data::Empty => return None,
        Data::String(s) => s.trim().to_string(),
        Data::Int(i) => i.to_string(),
        Data::Float(f) => {
            if f.fract() == 0.0 && f.abs() < 1e15 {
                format!("{}", *f as i64)
            } else {
                f.to_string()
            }
        }
        Data::Bool(b) => b.to_string(),
        Data::DateTime(d) => excel_serial_to_date(d.as_f64()).unwrap_or_default(),
        Data::DateTimeIso(s) => s.chars().take(10).collect(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(_) => return None,
    };
    let s = s.trim().to_string();
    if s.is_empty() || s == "-" { None } else { Some(s) }
}

fn excel_serial_to_date(serial: f64) -> Option<String> {
    if !(1.0..100_000.0).contains(&serial) {
        return None;
    }
    let base = chrono::NaiveDate::from_ymd_opt(1899, 12, 30)?;
    Some((base + chrono::Duration::days(serial.floor() as i64)).format("%Y-%m-%d").to_string())
}

/// Aceita "24/09/2014", "2014-09-24" e datas do Excel. Devolve AAAA-MM-DD.
pub fn parse_date(raw: &str) -> Option<String> {
    let t = raw.trim();
    for f in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"] {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(t.get(..10).unwrap_or(t), f) {
            return Some(d.format("%Y-%m-%d").to_string());
        }
    }
    None
}

pub fn parse_file(path: &Path) -> Result<ParsedFile> {
    let meta = std::fs::metadata(path)?;
    if meta.len() > MAX_BYTES {
        return Err(ClaraError::Invalid("o ficheiro é demasiado grande (máximo 50 MB)".into()));
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !["xlsx", "xlsm", "xls", "xlsb"].contains(&ext.as_str()) {
        return Err(ClaraError::Invalid("escolhe um ficheiro Excel (.xlsx, .xlsm ou .xls)".into()));
    }
    let bytes = std::fs::read(path)?;
    let sha256 = hex::encode(Sha256::digest(&bytes));
    let mut wb = open_workbook_auto(path).map_err(|e| ClaraError::Invalid(format!("não consegui ler o Excel: {e}")))?;
    let file_name = path.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();

    for sheet in wb.sheet_names() {
        let Ok(range) = wb.worksheet_range(&sheet) else { continue };
        let rows: Vec<&[Data]> = range.rows().collect();
        // Procura a linha de cabeçalho nas primeiras 20 linhas.
        let Some((hrow, header)) = rows.iter().enumerate().take(20).find(|(_, r)| {
            r.iter().any(|c| cell_text(c).map(|t| norm(&t) == "referencia").unwrap_or(false))
        }) else {
            continue;
        };
        let mut idx = std::collections::HashMap::new();
        for (i, c) in header.iter().enumerate() {
            if let Some(t) = cell_text(c) {
                let n = norm(&t);
                if COLUMNS.iter().any(|(k, _)| *k == n) {
                    idx.entry(n).or_insert(i);
                }
            }
        }
        let columns_found = COLUMNS.iter().filter(|(k, _)| idx.contains_key(*k)).map(|(_, l)| l.to_string()).collect();
        let columns_missing = COLUMNS.iter().filter(|(k, _)| !idx.contains_key(*k)).map(|(_, l)| l.to_string()).collect();
        let get = |r: &[Data], k: &str| idx.get(k).and_then(|i| r.get(*i)).and_then(cell_text);

        let mut out = vec![];
        let mut problems = vec![];
        let mut seen = std::collections::HashSet::new();
        for (n, r) in rows.iter().enumerate().skip(hrow + 1) {
            let line = n + 1;
            if r.iter().all(|c| cell_text(c).is_none()) {
                continue;
            }
            if out.len() >= MAX_ROWS {
                problems.push(RowProblem { line, message: format!("limite de {MAX_ROWS} linhas atingido; o resto foi ignorado") });
                break;
            }
            let Some(reference) = get(r, "referencia") else {
                problems.push(RowProblem { line, message: "linha sem referência".into() });
                continue;
            };
            if !seen.insert(reference_key(&reference)) {
                problems.push(RowProblem { line, message: format!("referência {reference} repetida no ficheiro") });
                continue;
            }
            let date = |k: &str, label: &str, problems: &mut Vec<RowProblem>| -> Option<String> {
                let raw = get(r, k)?;
                let d = if raw.len() == 10 && raw.as_bytes()[4] == b'-' { Some(raw.clone()) } else { parse_date(&raw) };
                if d.is_none() {
                    problems.push(RowProblem { line, message: format!("{label} ilegível ({raw}); fica em branco") });
                }
                d
            };
            let created_on = date("datadecriacao", "data de criação", &mut problems);
            let updated_on = date("datadealteracao", "data de alteração", &mut problems);
            let description = get(r, "descricao");
            out.push(EgoRow {
                line,
                reference,
                natureza: get(r, "natureza"),
                disponibilidade: get(r, "disponibilidade"),
                concelho: get(r, "concelho"),
                created_on,
                updated_on,
                has_description: description.is_some(),
                description,
            });
        }
        return Ok(ParsedFile { file_name, sha256, sheet, columns_found, columns_missing, rows: out, problems });
    }
    Err(ClaraError::Invalid("não encontrei nenhuma folha com a coluna \"Referência\"".into()))
}

#[derive(Clone, Debug, Serialize)]
pub struct FieldChange {
    pub field: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PreviewRow {
    pub line: usize,
    pub reference: String,
    pub natureza: Option<String>,
    pub concelho: Option<String>,
    pub disponibilidade: Option<String>,
    pub changes: Vec<FieldChange>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Preview {
    pub file_name: String,
    pub sheet: String,
    pub columns_found: Vec<String>,
    pub columns_missing: Vec<String>,
    pub rows_total: usize,
    pub new: Vec<PreviewRow>,
    pub changed: Vec<PreviewRow>,
    pub unchanged: usize,
    pub problems: Vec<RowProblem>,
    pub descriptions_in_file: usize,
    pub previously_applied_at: Option<String>,
}

struct Current {
    id: String,
    natureza: Option<String>,
    disponibilidade: Option<String>,
    concelho: Option<String>,
    created_on: Option<String>,
    updated_on: Option<String>,
    description: Option<String>,
}

fn current(conn: &Connection, reference: &str) -> Result<Option<Current>> {
    Ok(conn
        .query_row(
            "SELECT id, natureza, disponibilidade, concelho, ego_created_on, ego_updated_on, description_original
             FROM property WHERE ego_reference_key = ?1",
            [reference_key(reference)],
            |r| {
                Ok(Current {
                    id: r.get(0)?,
                    natureza: r.get(1)?,
                    disponibilidade: r.get(2)?,
                    concelho: r.get(3)?,
                    created_on: r.get(4)?,
                    updated_on: r.get(5)?,
                    description: r.get(6)?,
                })
            },
        )
        .optional()?)
}

fn diff(cur: &Current, row: &EgoRow, with_desc: bool) -> Vec<FieldChange> {
    let mut v = vec![];
    let mut cmp = |field: &str, a: &Option<String>, b: &Option<String>| {
        if a != b && b.is_some() {
            v.push(FieldChange { field: field.into(), before: a.clone(), after: b.clone() });
        }
    };
    cmp("Natureza", &cur.natureza, &row.natureza);
    cmp("Disponibilidade", &cur.disponibilidade, &row.disponibilidade);
    cmp("Concelho", &cur.concelho, &row.concelho);
    cmp("Data de criação", &cur.created_on, &row.created_on);
    cmp("Data de alteração", &cur.updated_on, &row.updated_on);
    if with_desc && cur.description != row.description && row.description.is_some() {
        // O texto não vai para a pré-visualização nem para o histórico.
        v.push(FieldChange { field: "Descrição original".into(), before: None, after: None });
    }
    v
}

pub fn preview(conn: &Connection, parsed: &ParsedFile, with_descriptions: bool) -> Result<Preview> {
    let mut new = vec![];
    let mut changed = vec![];
    let mut unchanged = 0;
    for row in &parsed.rows {
        let pr = |changes| PreviewRow {
            line: row.line,
            reference: row.reference.clone(),
            natureza: row.natureza.clone(),
            concelho: row.concelho.clone(),
            disponibilidade: row.disponibilidade.clone(),
            changes,
        };
        match current(conn, &row.reference)? {
            None => new.push(pr(vec![])),
            Some(cur) => {
                let d = diff(&cur, row, with_descriptions);
                if d.is_empty() {
                    unchanged += 1;
                } else {
                    changed.push(pr(d));
                }
            }
        }
    }
    let previously_applied_at = conn
        .query_row(
            "SELECT applied_at FROM import_run WHERE file_sha256 = ?1 ORDER BY applied_at DESC LIMIT 1",
            [&parsed.sha256],
            |r| r.get(0),
        )
        .optional()?;
    Ok(Preview {
        file_name: parsed.file_name.clone(),
        sheet: parsed.sheet.clone(),
        columns_found: parsed.columns_found.clone(),
        columns_missing: parsed.columns_missing.clone(),
        rows_total: parsed.rows.len(),
        new,
        changed,
        unchanged,
        problems: parsed.problems.clone(),
        descriptions_in_file: parsed.rows.iter().filter(|r| r.has_description).count(),
        previously_applied_at,
    })
}

#[derive(Clone, Debug, Serialize)]
pub struct ImportSummary {
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub invalid: usize,
}

pub fn apply(conn: &mut Connection, clock: &dyn Clock, parsed: &ParsedFile, with_descriptions: bool) -> Result<ImportSummary> {
    let now = ts(clock.now());
    let tx = conn.transaction()?;
    let (mut created, mut updated, mut unchanged) = (0, 0, 0);
    for row in &parsed.rows {
        let desc = if with_descriptions { row.description.clone() } else { None };
        match current(&tx, &row.reference)? {
            None => {
                let id = uuid::Uuid::new_v4().to_string();
                let label = [row.natureza.clone(), row.concelho.clone()].into_iter().flatten().collect::<Vec<_>>().join(" · ");
                tx.execute(
                    "INSERT INTO property (id, ego_reference_original, ego_reference_key, label, natureza, disponibilidade, concelho,
                       ego_created_on, ego_updated_on, description_original, source_seen_at, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?11)",
                    params![
                        id,
                        row.reference.trim(),
                        reference_key(&row.reference),
                        label,
                        row.natureza,
                        row.disponibilidade,
                        row.concelho,
                        row.created_on,
                        row.updated_on,
                        desc,
                        now
                    ],
                )?;
                history::record(
                    &tx,
                    clock,
                    Actor::Sistema,
                    NewEvent::new("property", Some(&id), "imovel.importado", format!("Imóvel importado do EGO: {}", row.reference.trim())).origin("importacao"),
                )?;
                created += 1;
            }
            Some(cur) => {
                let d = diff(&cur, row, with_descriptions);
                tx.execute("UPDATE property SET source_seen_at = ?1 WHERE id = ?2", params![now, cur.id])?;
                if d.is_empty() {
                    unchanged += 1;
                    continue;
                }
                tx.execute(
                    "UPDATE property SET natureza = COALESCE(?1, natureza), disponibilidade = COALESCE(?2, disponibilidade),
                       concelho = COALESCE(?3, concelho), ego_created_on = COALESCE(?4, ego_created_on),
                       ego_updated_on = COALESCE(?5, ego_updated_on), description_original = COALESCE(?6, description_original),
                       updated_at = ?7 WHERE id = ?8",
                    params![row.natureza, row.disponibilidade, row.concelho, row.created_on, row.updated_on, desc, now, cur.id],
                )?;
                let fields: Vec<_> = d.iter().map(|c| c.field.clone()).collect();
                let visible: Vec<_> = d.iter().filter(|c| c.field != "Descrição original").collect();
                history::record(
                    &tx,
                    clock,
                    Actor::Sistema,
                    NewEvent::new("property", Some(&cur.id), "imovel.atualizado_ego", format!("Atualizado do EGO: {} ({})", row.reference.trim(), fields.join(", ")))
                        .origin("importacao")
                        .payload(serde_json::json!(visible)),
                )?;
                updated += 1;
            }
        }
    }
    let invalid = parsed.problems.iter().filter(|p| !p.message.contains("fica em branco")).count();
    tx.execute(
        "INSERT INTO import_run (id, kind, file_name, file_sha256, sheet, rows_total, created, updated, unchanged, invalid, with_descriptions, applied_at)
         VALUES (?1, 'imoveis_ego', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            uuid::Uuid::new_v4().to_string(),
            parsed.file_name,
            parsed.sha256,
            parsed.sheet,
            parsed.rows.len() as i64,
            created as i64,
            updated as i64,
            unchanged as i64,
            invalid as i64,
            with_descriptions as i64,
            now
        ],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "import",
            None,
            "importacao.aplicada",
            format!("Importação EGO ({}): {created} novos, {updated} atualizados, {unchanged} iguais, {invalid} linhas com erro", parsed.file_name),
        ),
    )?;
    tx.commit()?;
    Ok(ImportSummary { created, updated, unchanged, invalid })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::clock::SystemClock;

    /// Ficheiro sintético com o formato da exportação do EGO (valores inventados).
    pub fn synthetic_xlsx(dir: &Path, rows: &[[&str; 11]]) -> std::path::PathBuf {
        let path = dir.join("listagem-teste.xlsm");
        let mut wb = rust_xlsxwriter::Workbook::new();
        let ws = wb.add_worksheet();
        ws.set_name("Imóveis").unwrap();
        let header = [
            "Referência", "Natureza", "Disponibilidade", "Venda (€)", "Trespasse (€)", "Arrendamento (€)", "Permuta (€)", "Concelho",
            "Data de criação", "Data de alteração", "Descrição",
        ];
        for (c, h) in header.iter().enumerate() {
            ws.write_string(0, c as u16, *h).unwrap();
        }
        for (r, row) in rows.iter().enumerate() {
            for (c, v) in row.iter().enumerate() {
                if c == 3 {
                    if let Ok(n) = v.parse::<f64>() {
                        ws.write_number(r as u32 + 1, c as u16, n).unwrap();
                        continue;
                    }
                }
                if !v.is_empty() {
                    ws.write_string(r as u32 + 1, c as u16, *v).unwrap();
                }
            }
        }
        wb.save(&path).unwrap();
        path
    }

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        crate::migrations::migrate(&mut c, &SystemClock).unwrap();
        c
    }

    const R1: [&str; 11] = ["TESTE-001", "Moradia", "Disponível", "250000", "-", "-", "-", "Faro", "01/02/2020", "15/09/2026", "Texto inventado A."];
    const R2: [&str; 11] = ["0042-T", "Apartamento", "Reservado", "-", "-", "900", "-", "Loulé", "03/03/2021", "2026-10-01", ""];

    #[test]
    fn parse_preview_apply_is_idempotent() {
        let t = tempfile::tempdir().unwrap();
        let f = synthetic_xlsx(t.path(), &[R1, R2]);
        let p = parse_file(&f).unwrap();
        assert_eq!(p.sheet, "Imóveis");
        assert_eq!(p.rows.len(), 2);
        assert!(p.columns_missing.is_empty(), "{:?}", p.columns_missing);
        assert_eq!(p.rows[1].reference, "0042-T", "zeros e hífen preservados");
        assert_eq!(p.rows[0].updated_on.as_deref(), Some("2026-09-15"));
        assert_eq!(p.rows[0].natureza.as_deref(), Some("Moradia"));

        let mut c = conn();
        let pv = preview(&c, &p, false).unwrap();
        assert_eq!((pv.new.len(), pv.changed.len(), pv.unchanged), (2, 0, 0));
        let s = apply(&mut c, &SystemClock, &p, false).unwrap();
        assert_eq!((s.created, s.updated, s.unchanged), (2, 0, 0));
        // Sem autorização, a descrição não é guardada.
        let d: Option<String> = c.query_row("SELECT description_original FROM property WHERE ego_reference_key = 'TESTE-001'", [], |r| r.get(0)).unwrap();
        assert!(d.is_none());

        // Repetir: nada muda, e a pré-visualização avisa que já foi aplicado.
        let pv2 = preview(&c, &p, false).unwrap();
        assert_eq!((pv2.new.len(), pv2.changed.len(), pv2.unchanged), (0, 0, 2));
        assert!(pv2.previously_applied_at.is_some());
        let events = history::count(&c).unwrap();
        let s2 = apply(&mut c, &SystemClock, &p, false).unwrap();
        assert_eq!((s2.created, s2.updated), (0, 0));
        assert_eq!(history::count(&c).unwrap(), events + 1, "só o registo da importação");
        assert!(history::verify_chain(&c).unwrap().ok);
    }

    #[test]
    fn changes_absences_duplicates_and_descriptions() {
        let t = tempfile::tempdir().unwrap();
        let mut c = conn();
        let p1 = parse_file(&synthetic_xlsx(t.path(), &[R1, R2])).unwrap();
        apply(&mut c, &SystemClock, &p1, false).unwrap();

        let mut r1b = R1;
        r1b[2] = "Vendido";
        let dup = R1;
        let p2 = parse_file(&synthetic_xlsx(t.path(), &[r1b, dup])).unwrap();
        assert_eq!(p2.rows.len(), 1);
        assert!(p2.problems.iter().any(|p| p.message.contains("repetida")));
        let pv = preview(&c, &p2, true).unwrap();
        assert_eq!(pv.changed.len(), 1);
        let fields: Vec<_> = pv.changed[0].changes.iter().map(|c| c.field.as_str()).collect();
        assert!(fields.contains(&"Disponibilidade") && fields.contains(&"Descrição original"));
        // A pré-visualização nunca mostra o texto da descrição.
        assert!(pv.changed[0].changes.iter().all(|c| c.after.as_deref() != Some("Texto inventado A.")));
        apply(&mut c, &SystemClock, &p2, true).unwrap();
        let (disp, desc): (String, Option<String>) = c
            .query_row("SELECT disponibilidade, description_original FROM property WHERE ego_reference_key = 'TESTE-001'", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!(disp, "Vendido");
        assert_eq!(desc.as_deref(), Some("Texto inventado A."));
        // O imóvel que não veio no segundo ficheiro continua lá.
        assert!(crate::property::find_by_ego(&c, "0042-T").unwrap().is_some());
        // A descrição não entra no histórico.
        let leaked: i64 = c.query_row("SELECT count(*) FROM history_payload WHERE content LIKE '%Texto inventado%'", [], |r| r.get(0)).unwrap();
        assert_eq!(leaked, 0);
    }

    #[test]
    fn wrong_files_are_rejected() {
        let t = tempfile::tempdir().unwrap();
        let txt = t.path().join("x.txt");
        std::fs::write(&txt, "Referência").unwrap();
        assert!(parse_file(&txt).is_err());
        let fake = t.path().join("x.xlsx");
        std::fs::write(&fake, "não é um excel").unwrap();
        assert!(parse_file(&fake).is_err());
    }

    #[test]
    fn dates() {
        assert_eq!(parse_date("24/09/2014").as_deref(), Some("2014-09-24"));
        assert_eq!(parse_date("2014-09-24").as_deref(), Some("2014-09-24"));
        assert_eq!(parse_date("ontem"), None);
        assert_eq!(excel_serial_to_date(45000.0).as_deref(), Some("2023-03-15"));
    }
}
