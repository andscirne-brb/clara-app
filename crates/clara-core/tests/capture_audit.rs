use clara_core::{
    capture_audit::{self, Audit},
    clock::FixedClock,
    collection::{Capture, Content},
    migrations,
};
use std::io::Write;
fn fixture(path: &std::path::Path, notes: &str, duplicate: bool) {
    let f = std::fs::File::create(path).unwrap();
    let mut z = zip::ZipWriter::new(f);
    let options = zip::write::SimpleFileOptions::default();
    let headers: Vec<String> = vec![
        "Referência EGO".into(),
        "Natureza".into(),
        "Concelho".into(),
        "Imagens".into(),
        "Alt-text".into(),
        "Descrição PT".into(),
        "Descrição EN".into(),
        "Descrição FR".into(),
        "Descrição DE".into(),
        "Descrição ES".into(),
        "Características".into(),
        "Vídeo".into(),
        "Visita Virtual".into(),
        "Planta".into(),
        "Caderneta Predial (anexo)".into(),
        "Certificado Energético (anexo)".into(),
        "Contrato Mediação (anexo)".into(),
        "Licença Habitação (anexo)".into(),
        "Folheto".into(),
        "N.º de imagens".into(),
        "Campos de características em falta".into(),
        "Observações / justificação N/A".into(),
        "Data da verificação".into(),
        "Ligação à ficha EGO".into(),
    ];
    let cells = |values: Vec<String>| {
        values
            .into_iter()
            .map(|s| format!("<c t=\"inlineStr\"><is><t>{s}</t></is></c>"))
            .collect::<String>()
    };
    let row = cells(vec!["TESTE-01".into(), "Moradia".into(), notes.into()]);
    for (name,data) in [
 ("_rels/.rels",r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"#.into()),
 ("[Content_Types].xml",r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>"#.into()),
 ("xl/workbook.xml",r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/><sheet name="Textos por idioma" sheetId="2" r:id="rId2"/></sheets></workbook>"#.into()),
 ("xl/_rels/workbook.xml.rels",r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>"#.into()),
 ("xl/worksheets/sheet1.xml",format!("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"9\">{}</row><row r=\"10\">{row}</row>{}</sheetData></worksheet>",cells(headers),if duplicate{format!("<row r=\"11\">{row}</row>")}else{String::new()}))
 ] {z.start_file(name,options).unwrap();z.write_all(data.as_bytes()).unwrap();}
    z.start_file("xl/worksheets/sheet2.xml", options).unwrap();
    z.write_all(r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="5"><c t="inlineStr"><is><t>Referência EGO</t></is></c><c t="inlineStr"><is><t>Idioma</t></is></c><c t="inlineStr"><is><t>Título original</t></is></c><c t="inlineStr"><is><t>Descrição original</t></is></c><c t="inlineStr"><is><t>Origem / evidência</t></is></c><c t="inlineStr"><is><t>Data de recolha</t></is></c><c t="inlineStr"><is><t>Estado da recolha</t></is></c></row><row r="6"><c t="inlineStr"><is><t>TESTE-01</t></is></c><c t="inlineStr"><is><t>PT</t></is></c><c t="inlineStr"><is><t>Título preservado</t></is></c><c t="inlineStr"><is><t>Texto anterior</t></is></c><c t="inlineStr"><is><t>Fonte anterior</t></is></c><c><v>46315</v></c><c t="inlineStr"><is><t>Recolhido</t></is></c></row></sheetData></worksheet>"#.as_bytes()).unwrap();
    z.finish().unwrap();
}

#[test]
fn prepare_requires_review_preserves_unknowns_and_never_writes_workbook() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("TESTE.xlsm");
    fixture(&path, "TESTE", false);
    let original = std::fs::read(&path).unwrap();
    let clock = FixedClock::new("2026-10-20T12:00:00Z".parse().unwrap());
    let mut c = rusqlite::Connection::open_in_memory().unwrap();
    migrations::migrate(&mut c, &clock).unwrap();
    let mut a = Audit {
        reference: "TESTE-01".into(),
        captures: vec![
            Capture {
                name: "TESTE-01.png".into(),
                text: "Texto fictício".into(),
            },
            Capture {
                name: "TESTE-01-b.png".into(),
                text: "Outra parte".into(),
            },
        ],
        contents: ["PT", "EN", "FR", "DE", "ES"]
            .into_iter()
            .map(|language| Content {
                language: language.into(),
                title: "".into(),
                description: "".into(),
                reviewed: false,
            })
            .collect(),
        states: std::collections::BTreeMap::new(),
        notes: "".into(),
        missing_features: "".into(),
        reference_confirmed: false,
        selected_features: vec![],
        feature_list_reviewed: false,
    };
    a.states.insert("D".into(), "Preenchido".into());
    assert!(capture_audit::prepare(&c, &clock, &path, &a).is_err());
    a.reference_confirmed = true;
    let p = capture_audit::prepare(&c, &clock, &path, &a).unwrap();
    assert_eq!(p.cells.len(), 1);
    assert_eq!(p.cells[0].column, "D");
    assert_eq!(p.cells[0].after, "Preenchido");
    assert_eq!(std::fs::read(&path).unwrap(), original);
    assert_eq!(
        capture_audit::draft(&c, "TESTE-01")
            .unwrap()
            .unwrap()
            .captures
            .len(),
        2
    );
    assert!(!capture_audit::prepared(&c, &p.id).unwrap().written);
    a.contents[0].reviewed = true;
    a.contents[0].description = "Texto PT TESTE revisto".into();
    a.missing_features = "Cozinha Equipada".into();
    a.states.insert("K".into(), "Preenchido".into());
    let p2 = capture_audit::prepare(&c, &clock, &path, &a).unwrap();
    assert!(
        p2.cells
            .iter()
            .any(|x| x.sheet == "Textos por idioma" && x.column == "D")
    );
    assert!(
        !p2.cells
            .iter()
            .any(|x| x.sheet == "Textos por idioma" && ["C", "F"].contains(&x.column.as_str()))
    );
    assert!(
        p2.cells
            .iter()
            .any(|x| x.sheet == "Levantamento" && x.column == "K" && x.after == "Em falta")
    );
    a.states.insert("Z".into(), "Preenchido".into());
    assert!(capture_audit::validate(&a).is_err());
    a.states.remove("Z");
    a.states.insert("D".into(), "Não aplicável".into());
    assert!(capture_audit::validate(&a).is_err());
    assert_eq!(
        capture_audit::extract("Menu\nDESCRIÇÃO\nTexto TESTE\nCARACTERÍSTICAS\nOutros dados")
            .as_deref(),
        Some("Texto TESTE")
    );
    assert!(capture_audit::extract("Sem secção identificada").is_none());
}

#[test]
fn obsolete_virtual_tour_boilerplate_is_removed_without_erasing_other_notes() {
    let note = "Observação TESTE\nVisita virtual: não aplicável em todos os imóveis, por decisão da responsável pelo levantamento.\nOutra observação TESTE";
    assert_eq!(
        capture_audit::clean_notes(note),
        "Observação TESTE\nOutra observação TESTE"
    );
    assert!(
        capture_audit::clean_notes("Visita virtual: não aplicável ao levantamento.").is_empty()
    );
}
