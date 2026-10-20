use clara_core::{clock::FixedClock, history, migrations, workbook_changes as changes};
use std::io::Write;
fn fixture(path: &std::path::Path, notes: &str, duplicate: bool) {
    let f = std::fs::File::create(path).unwrap();
    let mut z = zip::ZipWriter::new(f);
    let options = zip::write::SimpleFileOptions::default();
    let headers: Vec<String> = (0..24)
        .map(|i| match i {
            0 => "Referência EGO".into(),
            1 => "Natureza".into(),
            _ => format!("Campo {i}"),
        })
        .collect();
    let cells = |values: Vec<String>| {
        values
            .into_iter()
            .map(|s| format!("<c t=\"inlineStr\"><is><t>{s}</t></is></c>"))
            .collect::<String>()
    };
    let row = cells(vec!["TESTE-01".into(), "Moradia".into(), notes.into()]);
    for (name,data) in [
 ("[Content_Types].xml",r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>"#.into()),
 ("xl/workbook.xml",r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/></sheets></workbook>"#.into()),
 ("xl/_rels/workbook.xml.rels",r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>"#.into()),
 ("xl/worksheets/sheet1.xml",format!("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row>{}</row><row>{row}</row>{}</sheetData></worksheet>",cells(headers),if duplicate{format!("<row>{row}</row>")}else{String::new()}))
 ] {z.start_file(name,options).unwrap();z.write_all(data.as_bytes()).unwrap();}
    z.finish().unwrap();
}
#[test]
fn baseline_conflict_duplicate_and_idempotent_review() {
    let d = tempfile::tempdir().unwrap();
    let p = d.path().join("TESTE.xlsm");
    let clock = FixedClock::new("2026-10-20T12:00:00Z".parse().unwrap());
    let mut c = rusqlite::Connection::open_in_memory().unwrap();
    migrations::migrate(&mut c, &clock).unwrap();
    fixture(&p, "Antes", false);
    let r = changes::preview(&c, &clock, &p).unwrap();
    assert!(r.first_read);
    changes::accept(&mut c, &clock, &p, &r.token).unwrap();
    changes::accept(&mut c, &clock, &p, &r.token).unwrap();
    fixture(&p, "Depois", false);
    let r = changes::preview(&c, &clock, &p).unwrap();
    assert_eq!(r.changes.len(), 1);
    assert_eq!(r.changes[0].before, "Antes");
    fixture(&p, "Entretanto", false);
    assert!(changes::accept(&mut c, &clock, &p, &r.token).is_err());
    let r = changes::preview(&c, &clock, &p).unwrap();
    assert_eq!(r.changes[0].before, "Antes");
    changes::accept(&mut c, &clock, &p, &r.token).unwrap();
    let count: i64 = c
        .query_row("SELECT COUNT(*) FROM history_event", [], |r| r.get(0))
        .unwrap();
    changes::accept(&mut c, &clock, &p, &r.token).unwrap();
    assert_eq!(
        count,
        c.query_row::<i64, _, _>("SELECT COUNT(*) FROM history_event", [], |r| r.get(0))
            .unwrap()
    );
    fixture(&p, "Duplicado", true);
    assert!(changes::preview(&c, &clock, &p).is_err());
    assert!(history::verify_chain(&c).unwrap().ok);
}
