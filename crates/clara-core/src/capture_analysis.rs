//! Regras locais para transformar OCR em propostas com origem, nunca em factos confirmados.
use crate::{ClaraError, Result, capture_audit::Audit};
use serde::Serialize;
#[derive(Clone, Debug, Serialize)]
pub struct Proposal {
    pub field: String,
    pub language: String,
    pub value: String,
    pub source: String,
    pub evidence: String,
    pub partial: bool,
}
#[derive(Clone, Debug, Serialize)]
pub struct Analysis {
    pub proposals: Vec<Proposal>,
    pub warnings: Vec<String>,
}
pub fn norm(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            x if x.is_alphanumeric() => x,
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn desc_label(s: &str) -> bool {
    matches!(
        norm(s).as_str(),
        "descricao" | "description" | "beschreibung" | "descripcion"
    )
}
fn section(s: &str) -> bool {
    matches!(
        norm(s).as_str(),
        "caracteristicas"
            | "caracteristlcas"
            | "caracterlsticas"
            | "caracteristicas do imovel"
            | "features"
            | "details"
            | "detalhes"
            | "fotos"
            | "photos"
            | "proprietario"
            | "notas"
            | "documentos"
            | "limite de caracteres"
            | "limite de caracteres 4000"
    )
}
fn locale(s: &str) -> Option<&'static str> {
    match norm(s).as_str() {
        "portugues" | "portugues portugal" => Some("PT"),
        "english" | "ingles" | "english united kingdom" => Some("EN"),
        "francais" | "frances" => Some("FR"),
        "deutsch" | "alemao" => Some("DE"),
        "espanol" | "espanhol" => Some("ES"),
        _ => None,
    }
}
fn counter(s: &str) -> bool {
    let s = s.replace(' ', "");
    let Some((a, b)) = s.split_once('/') else {
        return false;
    };
    a.parse::<u32>().is_ok() && b.parse::<u32>().is_ok()
}
fn ui_line(s: &str) -> bool {
    let n = norm(s);
    locale(s).is_some()
        || counter(s)
        || n.starts_with("limite de caracteres")
        || n.starts_with("editar comissoes")
        || n.starts_with("adicionar preco")
        || n.starts_with("mais caracteristicas")
        || matches!(n.as_str(), "titulo" | "titulo o" | "descricao do imovel")
}
pub fn descriptions(text: &str, fallback: &str) -> Vec<(String, String, bool)> {
    let lines: Vec<_> = text.lines().map(str::trim).collect();
    let editing = lines
        .iter()
        .any(|l| norm(l).starts_with("limite de caracteres"));
    let mut out = vec![];
    for (i, line) in lines.iter().enumerate() {
        let inline = line
            .split_once(':')
            .filter(|(a, b)| desc_label(a) && !b.trim().is_empty());
        if !desc_label(line) && inline.is_none() {
            continue;
        }
        let mut language = fallback.to_string();
        let mut body = vec![];
        if let Some((_, b)) = inline {
            body.push(b.trim().to_string());
        }
        for next in &lines[i + 1..] {
            if section(next)
                || desc_label(next)
                || norm(next).starts_with("adicionar preco")
                || norm(next).starts_with("mais caracteristicas")
            {
                break;
            }
            if let Some(l) = locale(next) {
                if body.is_empty() {
                    language = l.into();
                } else {
                    break;
                }
                continue;
            }
            if next.is_empty() || ui_line(next) {
                continue;
            }
            body.push(next.to_string());
        }
        let value = body.join("\n").trim().to_string();
        if !value.is_empty() && value.chars().count() <= 32767 {
            out.push((language, value, editing));
        }
    }
    out
}
fn title(text: &str, fallback: &str) -> Option<(String, String)> {
    let lines: Vec<_> = text.lines().map(str::trim).collect();
    for (i, l) in lines.iter().enumerate() {
        let inline = l
            .split_once(':')
            .filter(|(h, _)| matches!(norm(h).as_str(), "titulo" | "title" | "titre" | "titel"));
        if let Some((_, v)) = inline {
            if !v.trim().is_empty() && v.chars().count() <= 1000 {
                return Some((fallback.into(), v.trim().into()));
            }
        }
        if !matches!(
            norm(l).as_str(),
            "titulo" | "titulo o" | "title" | "titre" | "titel"
        ) {
            continue;
        }
        let mut lang = fallback.to_string();
        let mut words = vec![];
        for next in lines.iter().skip(i + 1).take(20) {
            if desc_label(next) || norm(next).starts_with("limite de caracteres") {
                break;
            }
            if let Some(v) = locale(next) {
                lang = v.into();
                continue;
            }
            let n = norm(next);
            let field_label = [
                "preco por",
                "area ",
                "quart",
                "auartos",
                "casas de banho",
                "salas",
                "sala ",
            ]
            .iter()
            .any(|v| n.starts_with(v));
            if !next.is_empty()
                && !ui_line(next)
                && !field_label
                && n.len() > 3
                && n.split_whitespace().count() > 1
                && !next
                    .chars()
                    .all(|c| c.is_numeric() || c.is_whitespace() || c == '.' || c == ',')
            {
                words.push(*next);
            }
        }
        let value = words.join(" ");
        if !value.is_empty() && value.chars().count() <= 1000 {
            return Some((lang, value));
        }
    }
    None
}
fn feature_group(s: &str) -> bool {
    matches!(
        norm(s).as_str(),
        "divisoes"
            | "zona envolvente"
            | "equipamentos"
            | "infraestruturas"
            | "conforto e lazer"
            | "extras"
    )
}
pub fn analyse(a: &Audit, fallback: &str) -> Result<Analysis> {
    crate::capture_audit::validate(a)?;
    if !["PT", "EN", "FR", "DE", "ES"].contains(&fallback) {
        return Err(ClaraError::Invalid("Escolhe o idioma das capturas.".into()));
    }
    let mut result = Analysis {
        proposals: vec![],
        warnings: vec![],
    };
    for cap in &a.captures {
        let editing = cap
            .text
            .lines()
            .any(|l| norm(l).starts_with("limite de caracteres"));
        let mut add =
            |field: &str, language: String, value: String, evidence: String, partial: bool| {
                if !result.proposals.iter().any(|p| {
                    p.field == field
                        && p.language == language
                        && p.value == value
                        && p.source == cap.name
                }) {
                    result.proposals.push(Proposal {
                        field: field.into(),
                        language,
                        value,
                        source: cap.name.clone(),
                        evidence,
                        partial,
                    });
                }
            };
        for (lang, value, partial) in descriptions(&cap.text, fallback) {
            add(
                "description",
                lang,
                value.clone(),
                value.chars().take(240).collect(),
                partial,
            );
        }
        if let Some((lang, value)) = title(&cap.text, fallback) {
            add("title", lang, value.clone(), value, false);
        }
        // The presentation page lists selected features as text. The edit page also
        // contains UNCHECKED labels: never infer selection from those labels.
        if !editing {
            let mut collecting = false;
            let mut selected = vec![];
            for line in cap.text.lines() {
                if let Some((h, rest)) = line.split_once(':') {
                    if feature_group(h) {
                        collecting = true;
                        selected.extend(
                            rest.split(',')
                                .map(str::trim)
                                .filter(|v| !v.is_empty())
                                .map(str::to_string),
                        );
                        continue;
                    }
                }
                if collecting {
                    if section(line)
                        || norm(line).starts_with("publicar")
                        || norm(line).replace(' ', "").starts_with("registar")
                        || line.contains(':')
                        || line.trim().is_empty()
                    {
                        collecting = false;
                    } else {
                        let mut parts = line.split(',').map(str::trim).filter(|v| !v.is_empty());
                        if let Some(first) = parts.next() {
                            if let Some(last) = selected.last_mut() {
                                last.push(' ');
                                last.push_str(first);
                            } else {
                                selected.push(first.to_string());
                            }
                        }
                        selected.extend(parts.map(str::to_string));
                    }
                }
            }
            if !selected.is_empty() {
                let value = selected.join("\n");
                add(
                    "selected_features",
                    fallback.into(),
                    value.clone(),
                    value.chars().take(240).collect(),
                    false,
                );
            }
            // A gallery counter is evidence of at least one image, never evidence of
            // missing images. Ignore character counters on the edit page.
            let before = cap.text.lines().take_while(|l| !desc_label(l));
            for line in before {
                let compact = line.replace(' ', "");
                if let Some((left, right)) = compact.split_once('/') {
                    if let (Ok(current), Ok(total)) = (left.parse::<u32>(), right.parse::<u32>()) {
                        if current >= 1 && current <= total && total <= 5000 {
                            add("D", String::new(), "Preenchido".into(), line.into(), false);
                            break;
                        }
                    }
                }
            }
        }
        // Explicit attachment names/URLs are positive evidence. Empty sections,
        // buttons, energy ratings and text about a garden/pool prove no attachments.
        for line in cap.text.lines() {
            let low = line.to_lowercase();
            let n = norm(line);
            if low.contains(".pdf") {
                for (field, word) in [
                    ("O", "caderneta"),
                    ("P", "certificado energet"),
                    ("Q", "contrato mediacao"),
                    ("R", "licenca habit"),
                    ("N", "planta"),
                    ("S", "folheto"),
                    ("S", "brochure"),
                ] {
                    if n.contains(word) {
                        add(
                            field,
                            String::new(),
                            "Preenchido".into(),
                            line.into(),
                            false,
                        );
                    }
                }
            }
            if low.contains("youtu.be/")
                || low.contains("youtube.com/watch")
                || low.contains(".mp4")
                || low.contains(".webm")
            {
                add("L", String::new(), "Preenchido".into(), line.into(), false);
            }
        }
        if editing {
            result.warnings.push(format!("{}: ficha de edição; a descrição pode estar cortada pela caixa de texto. Prefere a captura da apresentação para o texto completo.",cap.name));
        }
    }
    if result.proposals.is_empty() {
        result.warnings.push("Não foram identificados campos com segurança. Abre o texto extraído: se estiver ilegível, usa uma captura mais aproximada; se não mostrar a informação, acrescenta a página de apresentação.".into());
    }
    let mut keys = std::collections::BTreeSet::new();
    for p in &result.proposals {
        keys.insert((p.field.clone(), p.language.clone()));
    }
    for (field, language) in keys {
        if field == "selected_features" {
            continue;
        }
        let list: Vec<_> = result
            .proposals
            .iter()
            .filter(|p| p.field == field && p.language == language)
            .collect();
        let complete: Vec<_> = list.iter().filter(|p| !p.partial).collect();
        let preferred = if complete.is_empty() {
            list
        } else {
            complete.into_iter().copied().collect()
        };
        if preferred
            .iter()
            .map(|p| norm(&p.value))
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            > 1
        {
            result.warnings.push(format!("Há propostas diferentes para {field} {language}. Escolhe a fonte correta; este campo não será preenchido automaticamente."));
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    // Executed locally against user-authorized captures; no real fixture is
    // checked in or sent to CI. CI exports only this synthetic-test executable.
    #[test]
    #[ignore = "Requires explicit local capture fixture and output paths"]
    fn analyse_local_capture_fixture() {
        let input = std::env::var_os("CLARA_QA_CAPTURE_INPUT").expect("local input path");
        let output = std::env::var_os("CLARA_QA_CAPTURE_OUTPUT").expect("local output path");
        let bytes = std::fs::read(input).unwrap();
        assert!(bytes.len() <= 5_000_000);
        let audit: Audit = serde_json::from_slice(&bytes).unwrap();
        let result = analyse(&audit, "PT").unwrap();
        assert!(result.proposals.iter().any(|p| p.field == "description"));
        std::fs::write(output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    }
    fn data(texts: &[&str]) -> Audit {
        Audit {
            reference: "TESTE-01".into(),
            captures: texts
                .iter()
                .enumerate()
                .map(|(i, s)| crate::collection::Capture {
                    name: format!("teste{i}.png"),
                    text: (*s).into(),
                })
                .collect(),
            contents: ["PT", "EN", "FR", "DE", "ES"]
                .iter()
                .map(|l| crate::collection::Content {
                    language: (*l).into(),
                    title: String::new(),
                    description: String::new(),
                    reviewed: false,
                })
                .collect(),
            states: Default::default(),
            notes: String::new(),
            missing_features: String::new(),
            reference_confirmed: false,
            selected_features: vec![],
            feature_list_reviewed: false,
        }
    }
    #[test]
    fn editor_extraction_uses_inner_heading_and_removes_controls() {
        let s = "Descrição do Imóvel\nÁREA BRUTA\n158\nEditar Comissões\nTÍTULO O\nPortuguês (Portugal)\nApartamento TESTE\nLIMITE DE CARACTERES\nDESCRICAO:\nPortuguês (Portugal)\nTexto visível da descrição.\n64/100\n492/4000\nLIMITE DE CARACTERES\nCaracterísticas\nPiscina";
        let a = analyse(&data(&[s]), "PT").unwrap();
        assert!(a.proposals.iter().any(|p| p.field == "description"
            && p.value == "Texto visível da descrição."
            && p.partial));
        assert!(
            a.proposals
                .iter()
                .any(|p| p.field == "title" && p.value == "Apartamento TESTE")
        );
        assert!(
            !a.proposals
                .iter()
                .any(|p| p.field == "selected_features" || p.field == "D")
        );
    }
    #[test]
    fn presentation_extracts_selected_features_and_positive_gallery() {
        let s = "TESTE-01\n1 / 7\nDescrição: Descrição completa do apartamento.\nCARACTERÍSTICAS\nDivisões: Cozinha(s), Varandas\nEquipamentos: Lareira\nDETALHES";
        let r = analyse(&data(&[s]), "PT").unwrap();
        assert!(r.proposals.iter().any(|p| p.field == "description"
            && !p.partial
            && p.value == "Descrição completa do apartamento."));
        assert!(r.proposals.iter().any(|p| p.field == "D"));
        assert!(
            r.proposals
                .iter()
                .any(|p| p.field == "selected_features" && p.value.contains("Lareira"))
        );
    }
    #[test]
    fn reordered_editor_labels_and_ocr_heading_errors_are_not_description() {
        let s = "Descrição do Imóvel\nTÍTULO O\nPREÇO POR M2 (ÁREA ÚTIL)\nÁREA gRUTA\naUARTos INTERIORES\nC\nÁREA TERRENO\nCASAS De BANHO\nSALAS\nsala 1\nApartamento TESTE com varanda\nLIMITE DE CARACTERES\nDESCRIÇÃO\nTexto parcial.\n+ Adicionar Preço\n+ Mais Características\nLIMITE DE CARACTERES";
        let r = analyse(&data(&[s]), "PT").unwrap();
        assert!(
            r.proposals
                .iter()
                .any(|p| p.field == "title" && p.value == "Apartamento TESTE com varanda")
        );
        assert!(
            r.proposals
                .iter()
                .any(|p| p.field == "description" && p.value == "Texto parcial.")
        );
        let r=analyse(&data(&["DESCRIÇÃO\nTexto completo.\nCARACTERÍSTlCAS\nZona Envolvente: Transportes\nPúblicos, Escola\nConforto e Lazer: Luz Natural\nReg istar apresentação\nLogs\nDocumentos"]),"PT").unwrap();
        assert!(
            r.proposals
                .iter()
                .any(|p| p.field == "description" && p.value == "Texto completo.")
        );
        assert!(r.proposals.iter().any(|p| p.field == "selected_features"
            && p.value == "Transportes Públicos\nEscola\nLuz Natural"));
    }
    #[test]
    fn absent_controls_do_not_prove_missing_or_present_documents() {
        let s = "Vídeos\nAdicionar vídeo\nPlantas\nAdicionar planta\nCertificado Energético\nClasse A\nCaderneta Predial\nAdicionar ficheiro";
        let r = analyse(&data(&[s]), "PT").unwrap();
        assert!(r.proposals.is_empty());
        assert!(!r.warnings.is_empty());
        let r = analyse(&data(&["caderneta TESTE.pdf\nplanta TESTE.pdf"]), "PT").unwrap();
        assert!(r.proposals.iter().any(|p| p.field == "O"));
        assert!(r.proposals.iter().any(|p| p.field == "N"));
        assert!(r.proposals.iter().all(|p| p.value != "Em falta"));
    }
    #[test]
    fn multiple_descriptions_keep_sources_and_warn_on_conflicts() {
        let r = analyse(
            &data(&[
                "DESCRIÇÃO\nVersão A\nCARACTERÍSTICAS",
                "DESCRIÇÃO\nVersão B\nCARACTERÍSTICAS",
            ]),
            "PT",
        )
        .unwrap();
        assert_eq!(r.proposals.len(), 2);
        assert!(
            r.warnings
                .iter()
                .any(|w| w.contains("propostas diferentes"))
        );
    }
}
