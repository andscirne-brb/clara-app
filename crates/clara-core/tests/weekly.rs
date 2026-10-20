use clara_core::{clock::FixedClock, history, migrations, weekly};
use std::io::{Cursor, Write};
fn fixture(path: &std::path::Path) {
    let mut z = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let opt = zip::write::SimpleFileOptions::default();
    let names = [
        "Levantamento",
        "Pendências da equipa",
        "Registo de alterações",
    ];
    let mut wb = String::from(
        r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>"#,
    );
    let mut rel = String::from(
        r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#,
    );
    let mut types = String::from(
        r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>"#,
    );
    for (i, name) in names.iter().enumerate() {
        let n = i + 1;
        wb.push_str(&format!(
            r#"<sheet name="{name}" sheetId="{n}" r:id="rId{n}"/>"#
        ));
        rel.push_str(&format!(r#"<Relationship Id="rId{n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{n}.xml"/>"#));
        types.push_str(&format!(r#"<Override PartName="/xl/worksheets/sheet{n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>"#));
    }
    wb.push_str("</sheets></workbook>");
    rel.push_str("</Relationships>");
    types.push_str("</Types>");
    let bookrels = r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"#;
    for (name, content) in [
        ("[Content_Types].xml", types.as_str()),
        ("_rels/.rels", bookrels),
        ("xl/workbook.xml", wb.as_str()),
        ("xl/_rels/workbook.xml.rels", rel.as_str()),
    ] {
        z.start_file(name, opt).unwrap();
        z.write_all(content.as_bytes()).unwrap();
    }
    let tables = vec![
        vec![
            vec![
                "Referência EGO",
                "Data da verificação",
                "Estado da verificação",
                "Natureza",
                "Concelho",
            ],
            vec![
                "TESTE-01",
                "19/10/2026",
                "Verificado",
                "Moradia TESTE",
                "Concelho TESTE",
            ],
        ],
        vec![
            vec![
                "ID",
                "Referência EGO",
                "Assunto",
                "Estado",
                "Aguarda análise de",
                "Resposta / decisão",
                "Data de resolução",
                "Verificação final",
                "Ação necessária",
                "Responsável",
            ],
            vec![
                "P1",
                "TESTE-01",
                "Áreas TESTE",
                "A aguardar esclarecimento",
                "Sara",
                "",
                "",
                "",
                "Confirmar TESTE",
                "Por atribuir",
            ],
            vec![
                "P2",
                "TESTE-01",
                "Documento TESTE",
                "Por tratar",
                "Por definir",
                "",
                "",
                "",
                "Rever TESTE",
                "Por atribuir",
            ],
            vec![
                "P3",
                "TESTE-01",
                "Falsa conclusão TESTE",
                "Concluído",
                "Sara",
                "",
                "",
                "Por verificar",
                "Conferir",
                "TESTE",
            ],
        ],
        vec![
            vec![
                "Data da alteração",
                "Referência EGO",
                "Autor",
                "Depois / alteração realizada",
                "Onde foi alterado",
                "Resultado da verificação",
                "Campo / assunto",
            ],
            vec![
                "19/10/2026",
                "TESTE-01",
                "TESTE",
                "Planta TESTE anexada",
                "eGO",
                "Confirmado",
                "Planta",
            ],
            vec![
                "19/10/2026",
                "TESTE-01",
                "TESTE",
                "Certificado TESTE anexado",
                "eGO",
                "Confirmado",
                "Certificado",
            ],
            vec![
                "01/10/2026",
                "TESTE-01",
                "TESTE",
                "FORA DO PERIODO",
                "eGO",
                "Confirmado",
                "TESTE",
            ],
            vec![
                "",
                "TESTE-01",
                "TESTE",
                "SEM DATA TESTE",
                "eGO",
                "",
                "TESTE",
            ],
        ],
    ];
    for (i, table) in tables.iter().enumerate() {
        let mut s = String::from(
            r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>"#,
        );
        for (r, row) in table.iter().enumerate() {
            s.push_str(&format!("<row r=\"{}\">", r + 1));
            for (c, text) in row.iter().enumerate() {
                s.push_str(&format!(
                    "<c r=\"{}{}\" t=\"inlineStr\"><is><t>{text}</t></is></c>",
                    (b'A' + c as u8) as char,
                    r + 1
                ));
            }
            s.push_str("</row>");
        }
        s.push_str("</sheetData></worksheet>");
        z.start_file(format!("xl/worksheets/sheet{}.xml", i + 1), opt)
            .unwrap();
        z.write_all(s.as_bytes()).unwrap();
    }
    std::fs::write(path, z.finish().unwrap().into_inner()).unwrap();
}

#[test]
fn profiles_are_dated_work_with_current_dependencies_and_no_publication_claim() {
    use std::io::Read;
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("Perfis TESTE.xlsx");
    fixture(&path);
    let bytes = std::fs::read(&path).unwrap();
    let mut old = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    let mut parts = std::collections::BTreeMap::new();
    for i in 0..old.len() {
        let mut f = old.by_index(i).unwrap();
        let mut b = Vec::new();
        f.read_to_end(&mut b).unwrap();
        parts.insert(f.name().to_string(), b);
    }
    for (id, name) in [(4, "Perfis dos portais"), (5, "Histórico dos perfis")] {
        let p = "xl/workbook.xml";
        let s = String::from_utf8(parts[p].clone()).unwrap().replace(
            "</sheets>",
            &format!(r#"<sheet name="{name}" sheetId="{id}" r:id="rId{id}"/></sheets>"#),
        );
        parts.insert(p.into(), s.into_bytes());
        let p = "xl/_rels/workbook.xml.rels";
        let s=String::from_utf8(parts[p].clone()).unwrap().replace("</Relationships>",&format!(r#"<Relationship Id="rId{id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{id}.xml"/></Relationships>"#));
        parts.insert(p.into(), s.into_bytes());
        let p = "[Content_Types].xml";
        let s=String::from_utf8(parts[p].clone()).unwrap().replace("</Types>",&format!(r#"<Override PartName="/xl/worksheets/sheet{id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>"#));
        parts.insert(p.into(), s.into_bytes());
        let rows = if id == 4 {
            vec![
                vec![
                    "Portal",
                    "Assunto",
                    "Ação / observação",
                    "Estado",
                    "Depende de",
                    "Data do registo",
                    "ID da versão",
                ],
                vec![
                    "green-acres",
                    "Validação",
                    "Aguardo validação da Idília TESTE",
                    "Em curso",
                    "Idília",
                    "2026-10-10",
                    "old",
                ],
                vec![
                    "green-acres",
                    "Texto do perfil",
                    "NÃO INCLUIR TEXTO LONGO",
                    "Em curso",
                    "",
                    "2026-10-20",
                    "new",
                ],
            ]
        } else {
            vec![
                vec!["Portal", "Data do registo", "ID da versão"],
                vec!["green-acres", "2026-10-20 19:50:00", "new"],
                vec!["green-acres", "2026-10-20 19:50:00", "new"],
                vec!["green-acres", "2026-10-10", "old"],
            ]
        };
        let mut xml = String::from(
            r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>"#,
        );
        for (i, row) in rows.iter().enumerate() {
            xml.push_str(&format!(r#"<row r="{}">"#, i + 1));
            for (j, t) in row.iter().enumerate() {
                xml.push_str(&format!(
                    r#"<c r="{}{}" t="inlineStr"><is><t>{}</t></is></c>"#,
                    (b'A' + j as u8) as char,
                    i + 1,
                    t
                ));
            }
            xml.push_str("</row>");
        }
        xml.push_str("</sheetData></worksheet>");
        parts.insert(format!("xl/worksheets/sheet{id}.xml"), xml.into_bytes());
    }
    let mut z = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (n, b) in parts {
        z.start_file(n, zip::write::SimpleFileOptions::default())
            .unwrap();
        z.write_all(&b).unwrap();
    }
    std::fs::write(&path, z.finish().unwrap().into_inner()).unwrap();
    let clock = FixedClock::new("2026-10-23T12:00:00Z".parse().unwrap());
    let r = weekly::build(&path, "2026-10-17", "2026-10-23", &clock).unwrap();
    assert_eq!(r.closing.matches("Registei uma versão").count(), 1);
    assert!(r.closing.contains("Aguardo validação da Idília TESTE"));
    assert!(r.closing.contains("não confirma publicação"));
    assert!(!r.closing.contains("NÃO INCLUIR TEXTO LONGO"));
    assert!(r.closing.contains("Depende de: Idília"));
}
#[test]
fn report_reads_same_workbook_filters_dates_separates_sara_and_preserves_history() {
    let temp = tempfile::tempdir().unwrap();
    let p = temp.path().join("TESTE.xlsm");
    fixture(&p);
    let before = std::fs::read(&p).unwrap();
    let clock = FixedClock::new("2026-10-23T19:15:00Z".parse().unwrap());
    let tracker = weekly::tracker(&p, &clock).unwrap();
    assert_eq!(tracker.len(), 1);
    assert_eq!(tracker[0].nature, "Moradia TESTE");
    assert!(!tracker[0].pending.is_empty());
    assert_eq!(weekly::fingerprint(&p).unwrap().len(), 64);
    let report = weekly::build(&p, "2026-10-17", "2026-10-23", &clock).unwrap();
    assert_eq!(std::fs::read(&p).unwrap(), before);
    assert!(report.body.contains("Planta TESTE anexada"));
    assert!(!report.body.contains("FORA DO PERIODO"));
    assert!(report.body.contains("Conclusão por validar"));
    assert_eq!(report.properties.len(), 1);
    let property = &report.properties[0];
    assert_eq!(property.reference, "TESTE-01");
    assert!(
        property
            .work
            .iter()
            .any(|s| s.contains("Planta TESTE anexada"))
    );
    assert!(
        property
            .work
            .iter()
            .any(|s| s.contains("Certificado TESTE anexado"))
    );
    assert!(property.pending.iter().any(|s| s.contains("Áreas TESTE")));
    assert!(
        property
            .pending
            .iter()
            .any(|s| s.contains("Documento TESTE"))
    );
    assert!(!report.body.contains("Autor:"));
    assert!(!report.body.contains("P1:"));
    assert!(!report.body.contains("P2:"));
    assert!(!report.body.contains(" / P3"));
    // Reports saved before the table feature still deserialize without being rewritten.
    let mut legacy = serde_json::to_value(&report).unwrap();
    for key in ["properties", "intro", "closing"] {
        legacy.as_object_mut().unwrap().remove(key);
    }
    let old: weekly::Report = serde_json::from_value(legacy).unwrap();
    assert!(old.properties.is_empty());
    assert_eq!(old.body, report.body);
    assert!(!report.warnings.is_empty());
    let mut c = rusqlite::Connection::open_in_memory().unwrap();
    migrations::migrate(&mut c, &clock).unwrap();
    weekly::save(&mut c, &clock, &report).unwrap();
    let second = weekly::build(&p, "2026-10-17", "2026-10-23", &clock).unwrap();
    weekly::save(&mut c, &clock, &second).unwrap();
    let history = weekly::recent(&c).unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[1].body, report.body);
    assert!(history::verify_chain(&c).unwrap().ok);
    assert!(weekly::build(&p, "2026-10-23", "2026-10-17", &clock).is_err());
}
