//! Importação manual. Nunca executa macros, fórmulas, ligações ou aplicações externas.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    cycle::{self, PropertyInput},
    history::{self, Actor, NewEvent},
};
use calamine::{Data, Reader, Xlsx};
use chrono::NaiveDate;
use rusqlite::{Connection, params};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    io::{Cursor, Read},
    path::Path,
};

const MAX_BYTES: u64 = 20 * 1024 * 1024;
const MAX_ROWS: usize = 10_000;
fn invalid(s: &str) -> ClaraError {
    ClaraError::Invalid(s.into())
}
pub(crate) fn read_file(path: &Path) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err(invalid(
            "O ficheiro excede 20 MB. Exporta apenas a folha necessária.",
        ));
    }
    Ok(bytes)
}
pub(crate) fn workbook(bytes: &[u8]) -> Result<Xlsx<Cursor<&[u8]>>> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| invalid("O ficheiro Excel está danificado ou protegido por palavra-passe."))?;
    if zip.len() > 5000 {
        return Err(invalid("O ficheiro Excel tem demasiados componentes."));
    }
    let mut total = 0u64;
    for i in 0..zip.len() {
        let entry = zip
            .by_index(i)
            .map_err(|_| invalid("Não foi possível ler o ficheiro Excel."))?;
        total = total.saturating_add(entry.size());
    }
    if total > 128 * 1024 * 1024 {
        return Err(invalid(
            "O conteúdo descomprimido excede 128 MB. Exporta uma folha mais pequena.",
        ));
    }
    Xlsx::new(Cursor::new(bytes)).map_err(|_| {
        invalid("Não foi possível abrir o Excel. Usa .xlsx ou .xlsm sem palavra-passe.")
    })
}
fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase()
}
pub fn sheets(path: &Path) -> Result<Vec<String>> {
    let bytes = read_file(path)?;
    match extension(path).as_str() {
        "csv" => Ok(vec!["CSV".into()]),
        "xlsx" | "xlsm" => Ok(workbook(&bytes)?.sheet_names()),
        _ => Err(invalid("Escolhe um ficheiro .xlsm, .xlsx ou .csv.")),
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct ImportRow {
    pub row: usize,
    pub input: PropertyInput,
    #[serde(skip)]
    pub description: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub changes: Vec<String>,
}
#[derive(Clone, Debug, Serialize)]
pub struct Preview {
    pub token: String,
    pub sheet: String,
    pub description_enabled: bool,
    pub rows: Vec<ImportRow>,
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub errors: usize,
}
pub struct PendingImport {
    pub preview: Preview,
    source_sha256: String,
    baseline: String,
}
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
}
fn baseline(conn: &Connection) -> Result<String> {
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(
        &cycle::properties(conn)?,
    )?)))
}
fn header(value: &str) -> String {
    value.trim().trim_start_matches('\u{feff}').to_lowercase()
}
fn date(value: &str) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value == "-" {
        return Ok(String::new());
    }
    for format in ["%d/%m/%Y", "%Y-%m-%d"] {
        if let Ok(d) = NaiveDate::parse_from_str(value, format) {
            return Ok(d.format("%Y-%m-%d").to_string());
        }
    }
    Err(invalid(
        "Data de alteração inválida. Usa DD/MM/AAAA ou AAAA-MM-DD.",
    ))
}
struct RawRow {
    number: usize,
    cells: Vec<String>,
    bad_reference: bool,
    formula: bool,
}
fn read_rows(
    bytes: &[u8],
    ext: &str,
    sheet: &str,
    include_description: bool,
) -> Result<(Vec<String>, Vec<RawRow>)> {
    if ext == "csv" {
        if sheet != "CSV" {
            return Err(invalid("Folha CSV inválida."));
        }
        let first = bytes.split(|b| *b == b'\n').next().unwrap_or(&[]);
        let delimiter = if first.iter().filter(|b| **b == b';').count()
            > first.iter().filter(|b| **b == b',').count()
        {
            b';'
        } else {
            b','
        };
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .from_reader(bytes);
        let headers = reader
            .headers()
            .map_err(|_| invalid("O CSV tem de estar em UTF-8 e incluir os cabeçalhos."))?
            .iter()
            .map(str::to_string)
            .collect();
        let mut rows = vec![];
        for (n, row) in reader.records().enumerate() {
            if n >= MAX_ROWS {
                return Err(invalid("O ficheiro excede 10 000 linhas."));
            }
            let row = row.map_err(|_| {
                invalid(
                    "O CSV tem linhas inválidas. Revê o número de colunas e a codificação UTF-8.",
                )
            })?;
            rows.push(RawRow {
                number: n + 2,
                cells: row.iter().map(str::to_string).collect(),
                bad_reference: false,
                formula: false,
            });
        }
        return Ok((headers, rows));
    }
    let mut book = workbook(bytes)?;
    let range = book
        .worksheet_range(sheet)
        .map_err(|_| invalid("Não foi possível ler a folha escolhida."))?;
    if range.height() > MAX_ROWS + 1 || range.width() > 1000 {
        return Err(invalid(
            "A folha excede 10 000 linhas ou 1 000 colunas. Exporta apenas a tabela necessária.",
        ));
    }
    let formulas = book
        .worksheet_formula(sheet)
        .map_err(|_| invalid("Não foi possível verificar as fórmulas da folha."))?;
    let mut iter = range.rows();
    let headings = iter.next().ok_or_else(|| invalid("A folha está vazia."))?;
    let headers: Vec<String> = headings.iter().map(ToString::to_string).collect();
    let ref_col = headers.iter().position(|h| header(h) == "referência");
    let mapped: Vec<usize> = headers
        .iter()
        .enumerate()
        .filter(|(_, h)| {
            [
                "referência",
                "natureza",
                "concelho",
                "disponibilidade",
                "data de alteração",
            ]
            .contains(&header(h).as_str())
                || (include_description && header(h) == "descrição")
        })
        .map(|(i, _)| i)
        .collect();
    let start = range.start().unwrap_or((0, 0));
    let mut rows = vec![];
    for (i, row) in iter.enumerate() {
        let abs_row = start.0 + i as u32 + 1;
        let formula = mapped.iter().any(|col| {
            formulas
                .get_value((abs_row, start.1 + *col as u32))
                .is_some_and(|v| !v.is_empty())
        });
        let bad_reference = ref_col
            .and_then(|col| row.get(col))
            .is_some_and(|v| !matches!(v, Data::String(_) | Data::Empty));
        let cells = row
            .iter()
            .map(|cell| match cell {
                Data::DateTime(d) => d
                    .as_datetime()
                    .map(|v| v.date().format("%Y-%m-%d").to_string())
                    .unwrap_or_else(|| cell.to_string()),
                _ => cell.to_string(),
            })
            .collect();
        rows.push(RawRow {
            number: abs_row as usize + 1,
            cells,
            bad_reference,
            formula,
        });
    }
    Ok((headers, rows))
}
pub fn preview(
    conn: &Connection,
    path: &Path,
    sheet: &str,
    include_description: bool,
) -> Result<PendingImport> {
    let ext = extension(path);
    if !["xlsm", "xlsx", "csv"].contains(&ext.as_str()) {
        return Err(invalid("Formato não suportado."));
    }
    let bytes = read_file(path)?;
    let source_sha256 = hex::encode(Sha256::digest(&bytes));
    let (headers, raw) = read_rows(&bytes, &ext, sheet, include_description)?;
    let mut columns = HashMap::new();
    for (i, h) in headers.iter().enumerate() {
        let key = header(h);
        if columns.insert(key.clone(), i).is_some() && !key.is_empty() {
            return Err(invalid(
                "Existem cabeçalhos repetidos. Corrige a primeira linha.",
            ));
        }
    }
    for required in [
        "referência",
        "natureza",
        "disponibilidade",
        "concelho",
        "data de alteração",
    ] {
        if !columns.contains_key(required) {
            return Err(invalid(&format!(
                "Falta a coluna «{required}» na primeira linha da folha."
            )));
        }
    }
    if include_description && !columns.contains_key("descrição") {
        return Err(invalid("A coluna Descrição não existe nesta folha."));
    }
    let mut rows = vec![];
    for raw in raw {
        if raw.cells.iter().all(|s| s.trim().is_empty()) {
            continue;
        }
        let value = |key: &str| {
            columns
                .get(key)
                .and_then(|i| raw.cells.get(*i))
                .map(|s| s.trim().to_string())
                .unwrap_or_default()
        };
        let mut input = PropertyInput {
            ego_ref: value("referência"),
            nature: value("natureza"),
            municipality: value("concelho"),
            availability: value("disponibilidade"),
            ego_modified: value("data de alteração"),
        };
        let mut error = None;
        if raw.bad_reference {
            error=Some("Referência numérica no Excel: converte-a em texto para preservar os zeros iniciais.".into());
        }
        if raw.formula {
            error=Some("Há fórmulas em colunas a importar. Exporta valores fixos; a Clara não calcula fórmulas.".into());
        }
        match date(&input.ego_modified) {
            Ok(v) => input.ego_modified = v,
            Err(e) => error = Some(e.to_string()),
        }
        if let Err(e) = input.validated() {
            error = Some(e.to_string());
        }
        let description = if include_description {
            let d = value("descrição");
            if let Err(e) = cycle::text(&d, "descrição", 50_000, false) {
                error = Some(e.to_string());
            }
            Some(d)
        } else {
            None
        };
        rows.push(ImportRow {
            row: raw.number,
            input,
            description,
            status: String::new(),
            error,
            changes: vec![],
        });
    }
    if rows.is_empty() {
        return Err(invalid("Não há imóveis para importar nesta folha."));
    }
    let mut seen = HashSet::new();
    let mut duplicates = HashSet::new();
    for row in &rows {
        if !seen.insert(&row.input.ego_ref) {
            duplicates.insert(row.input.ego_ref.clone());
        }
    }
    let (mut created, mut updated, mut unchanged, mut errors) = (0, 0, 0, 0);
    for row in &mut rows {
        if duplicates.contains(&row.input.ego_ref) {
            row.error = Some(
                "Referência repetida neste ficheiro. Resolve a duplicação antes de importar."
                    .into(),
            );
        }
        if row.error.is_some() {
            row.status = "erro".into();
            errors += 1;
            continue;
        }
        match cycle::property_by_ref(conn, &row.input.ego_ref)? {
            None => {
                row.status = "novo".into();
                created += 1;
            }
            Some(p) => {
                for (label, before, after) in [
                    ("Natureza", &p.nature, &row.input.nature),
                    ("Concelho", &p.municipality, &row.input.municipality),
                    ("Disponibilidade", &p.availability, &row.input.availability),
                    ("Data EGO", &p.ego_modified, &row.input.ego_modified),
                ] {
                    if before != after {
                        row.changes.push(format!("{label}: «{before}» → «{after}»"));
                    }
                }
                if row
                    .description
                    .as_ref()
                    .is_some_and(|d| Some(d) != p.original_description.as_ref())
                {
                    row.changes
                        .push("A descrição original será atualizada.".into());
                }
                if !p.ego_modified.is_empty()
                    && !row.input.ego_modified.is_empty()
                    && row.input.ego_modified < p.ego_modified
                {
                    row.changes.push("Atenção: a data EGO importada é anterior à guardada. Confirma que escolheste a exportação correta.".into());
                }
                let same = p.nature == row.input.nature
                    && p.municipality == row.input.municipality
                    && p.availability == row.input.availability
                    && p.ego_modified == row.input.ego_modified
                    && row
                        .description
                        .as_ref()
                        .is_none_or(|d| Some(d) == p.original_description.as_ref());
                if same {
                    row.status = "igual".into();
                    unchanged += 1;
                } else {
                    row.status = "alterado".into();
                    updated += 1;
                }
            }
        }
    }
    Ok(PendingImport {
        baseline: baseline(conn)?,
        source_sha256,
        preview: Preview {
            token: uuid::Uuid::new_v4().to_string(),
            sheet: sheet.into(),
            description_enabled: include_description,
            rows,
            created,
            updated,
            unchanged,
            errors,
        },
    })
}
pub fn apply(
    conn: &mut Connection,
    clock: &dyn Clock,
    pending: &PendingImport,
    token: &str,
) -> Result<ImportResult> {
    if token != pending.preview.token {
        return Err(invalid(
            "A pré-visualização expirou. Volta a carregar o ficheiro.",
        ));
    }
    if pending.preview.errors > 0 {
        return Err(invalid(
            "Corrige os erros do ficheiro antes de importar. Nenhum imóvel foi gravado.",
        ));
    }
    let tx = conn.transaction()?;
    if baseline(&tx)? != pending.baseline {
        return Err(invalid(
            "Os imóveis mudaram depois da pré-visualização. Atualiza a pré-visualização antes de confirmar.",
        ));
    }
    for row in &pending.preview.rows {
        if row.status != "igual" {
            cycle::write_property(
                &tx,
                clock,
                &row.input,
                row.description.as_deref(),
                "importacao_ego",
            )?;
        }
    }
    let p = &pending.preview;
    let id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO ego_import VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            id,
            pending.source_sha256,
            p.sheet,
            p.description_enabled,
            p.created as i64,
            p.updated as i64,
            p.unchanged as i64,
            ts(clock.now())
        ],
    )?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "import",
            Some(&id),
            "ego.importado",
            format!(
                "Importação EGO: {} novos, {} alterados, {} iguais",
                p.created, p.updated, p.unchanged
            ),
        ),
    )?;
    tx.commit()?;
    Ok(ImportResult {
        created: p.created,
        updated: p.updated,
        unchanged: p.unchanged,
    })
}
