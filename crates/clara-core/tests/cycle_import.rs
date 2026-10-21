//! Apenas dados fictícios TESTE. Não requer EGO, portais ou ficheiros da empresa.
use clara_core::{
    backup,
    clock::FixedClock,
    cycle::{self, AuditItem, ListingInput, PropertyInput},
    ego_import, history,
    keys::{KdfParams, SecretKind},
    migrations,
    paths::DataDir,
    vault::Vault,
};
use rusqlite::Connection;
use std::{
    io::{Cursor, Write},
    path::Path,
    sync::Arc,
};

fn clock() -> FixedClock {
    FixedClock::new("2026-10-19T12:00:00Z".parse().unwrap())
}
fn conn() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    c.execute_batch("PRAGMA foreign_keys=ON").unwrap();
    migrations::migrate(&mut c, &clock()).unwrap();
    c
}
fn input(reference: &str) -> PropertyInput {
    PropertyInput {
        ego_ref: reference.into(),
        nature: "Apartamento TESTE".into(),
        municipality: "Concelho TESTE".into(),
        availability: "Disponível".into(),
        ego_modified: String::new(),
    }
}
fn property(c: &mut Connection) -> cycle::Property {
    cycle::create_property(c, &clock(), input("TESTE-0001")).unwrap()
}
fn listing(c: &mut Connection, p: &str, portal: &str) -> cycle::Listing {
    cycle::save_listing(
        c,
        &clock(),
        None,
        ListingInput {
            property_id: p.into(),
            portal_id: portal.into(),
            portal_ref: format!("{portal}-0002"),
            url: "https://example.org/anuncio-teste".into(),
            visibility: "ativa".into(),
            monitoring: true,
        },
    )
    .unwrap()
}
fn items() -> Vec<AuditItem> {
    cycle::CHECKLIST
        .iter()
        .map(|(field, _)| AuditItem {
            field: field.to_string(),
            state: if *field == "planta" {
                "nao_conforme"
            } else {
                "por_verificar"
            }
            .into(),
            note: if *field == "planta" {
                "TESTE: planta ausente na publicação"
            } else {
                ""
            }
            .into(),
        })
        .collect()
}
fn csv_file(path: &Path, body: &str) {
    std::fs::write(path,format!("Referência;Natureza;Disponibilidade;Concelho;Data de alteração;Descrição;Venda (€)\n{body}")).unwrap();
}

#[test]
fn identity_listing_references_and_archive_preserve_relationships() {
    let mut c = conn();
    let p = property(&mut c);
    assert_eq!(
        cycle::create_property(&mut c, &clock(), input("TESTE-0001"))
            .unwrap()
            .id,
        p.id
    );
    let a = listing(&mut c, &p.id, "idealista-pt");
    let b = listing(&mut c, &p.id, "kyero-pt");
    assert_ne!(a.portal_ref, b.portal_ref);
    assert_eq!(cycle::properties(&c).unwrap().len(), 1);
    cycle::archive_property(&mut c, &clock(), &p.id, true).unwrap();
    assert_eq!(cycle::listings(&c).unwrap().len(), 2);
    cycle::archive_property(&mut c, &clock(), &p.id, false).unwrap();
    assert!(!cycle::get_property(&c, &p.id).unwrap().archived);
    assert!(history::verify_chain(&c).unwrap().ok);
}
#[test]
fn qa_requires_public_url_and_latest_change_and_can_reopen() {
    let mut c = conn();
    let p = property(&mut c);
    let l = listing(&mut c, &p.id, "idealista-pt");
    cycle::record_audit(&mut c, &clock(), &l.id, items()).unwrap();
    let issue = cycle::issues(&c, Some(&l.id)).unwrap().remove(0);
    assert_eq!(issue.status, "detetado");
    let change = cycle::record_change(
        &mut c,
        &clock(),
        &issue.id,
        "portal",
        "Planta / PT",
        "TESTE: planta publicada manualmente",
    )
    .unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "qa_pendente");
    assert!(
        cycle::record_qa(
            &mut c,
            &clock(),
            &change,
            "aprovado",
            "https://example.org/outro",
            "TESTE: URL errada"
        )
        .is_err()
    );
    cycle::record_qa(
        &mut c,
        &clock(),
        &change,
        "nao_verificavel",
        &l.url,
        "TESTE: anúncio indisponível",
    )
    .unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "qa_pendente");
    cycle::record_qa(
        &mut c,
        &clock(),
        &change,
        "aprovado",
        &l.url,
        "TESTE: planta visível e legível",
    )
    .unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "resolvido");
    cycle::record_qa(
        &mut c,
        &clock(),
        &change,
        "falhou",
        &l.url,
        "TESTE: planta deixou de estar visível",
    )
    .unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "reaberto");
    let newer = cycle::record_change(
        &mut c,
        &clock(),
        &issue.id,
        "ego",
        "Planta / PT",
        "TESTE: nova edição",
    )
    .unwrap();
    assert!(
        cycle::record_qa(
            &mut c,
            &clock(),
            &change,
            "aprovado",
            &l.url,
            "TESTE: edição antiga"
        )
        .is_err()
    );
    cycle::record_qa(
        &mut c,
        &clock(),
        &newer,
        "aprovado",
        &l.url,
        "TESTE: nova edição confirmada",
    )
    .unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "resolvido");
    let edit = ListingInput {
        property_id: p.id,
        portal_id: l.portal_id,
        portal_ref: l.portal_ref,
        url: "https://example.org/nova-url".into(),
        visibility: l.visibility,
        monitoring: true,
    };
    cycle::save_listing(&mut c, &clock(), Some(l.id), edit).unwrap();
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "reaberto");
    assert!(history::verify_chain(&c).unwrap().ok);
}
#[test]
fn audit_na_requires_reason_and_does_not_duplicate_open_issues() {
    let mut c = conn();
    let p = property(&mut c);
    let l = listing(&mut c, &p.id, "idealista-pt");
    let mut a = items();
    a[0].state = "nao_aplicavel".into();
    assert!(cycle::record_audit(&mut c, &clock(), &l.id, a.clone()).is_err());
    a[0].note = "TESTE: capacidade não suportada, levantamento manual".into();
    cycle::save_audit_draft(&c, &clock(), &l.id, a.clone()).unwrap();
    assert!(cycle::audit_draft(&c, &l.id).unwrap().is_some());
    cycle::record_audit(&mut c, &clock(), &l.id, a.clone()).unwrap();
    assert!(cycle::audit_draft(&c, &l.id).unwrap().is_none());
    cycle::record_audit(&mut c, &clock(), &l.id, a).unwrap();
    assert_eq!(cycle::audits(&c, &l.id).unwrap().len(), 2);
    assert_eq!(cycle::issues(&c, None).unwrap().len(), 1);
}
#[test]
fn failed_history_rolls_back_domain_write() {
    let mut c = conn();
    let p = property(&mut c);
    let l = listing(&mut c, &p.id, "idealista-pt");
    cycle::record_audit(&mut c, &clock(), &l.id, items()).unwrap();
    let issue = cycle::issues(&c, None).unwrap().remove(0);
    c.execute_batch("CREATE TRIGGER fail_history BEFORE INSERT ON history_event WHEN NEW.action='edicao.manual' BEGIN SELECT RAISE(ABORT,'TESTE: falha transacional'); END;").unwrap();
    assert!(
        cycle::record_change(&mut c, &clock(), &issue.id, "portal", "Planta", "TESTE").is_err()
    );
    let count: i64 = c
        .query_row("SELECT count(*) FROM manual_change", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
    assert_eq!(cycle::issues(&c, None).unwrap()[0].status, "detetado");
}
#[test]
fn import_preview_idempotence_absence_description_and_stale_preview() {
    let mut c = conn();
    let temp = tempfile::tempdir().unwrap();
    let file = temp.path().join("ego-teste.csv");
    csv_file(
        &file,
        "000001;Moradia TESTE;Disponível;TESTE;19/10/2026;Descrição fictícia;999\n000002;Loja TESTE;Disponível;TESTE;;Outra descrição fictícia;123\n",
    );
    let preview = ego_import::preview(&c, &file, "CSV", false).unwrap();
    assert_eq!(preview.preview.created, 2);
    assert_eq!(cycle::properties(&c).unwrap().len(), 0);
    assert_eq!(
        ego_import::apply(&mut c, &clock(), &preview, &preview.preview.token)
            .unwrap()
            .created,
        2
    );
    let first = cycle::property_by_ref(&c, "000001").unwrap().unwrap();
    assert_eq!(first.ego_ref, "000001");
    assert!(first.original_description.is_none());
    let repeated = ego_import::preview(&c, &file, "CSV", false).unwrap();
    assert_eq!(repeated.preview.unchanged, 2);
    ego_import::apply(&mut c, &clock(), &repeated, &repeated.preview.token).unwrap();
    assert_eq!(cycle::properties(&c).unwrap().len(), 2);
    let descriptions = ego_import::preview(&c, &file, "CSV", true).unwrap();
    ego_import::apply(&mut c, &clock(), &descriptions, &descriptions.preview.token).unwrap();
    assert!(
        cycle::property_by_ref(&c, "000001")
            .unwrap()
            .unwrap()
            .original_description
            .is_some()
    );
    csv_file(
        &file,
        "000001;Moradia TESTE;Indisponível;TESTE;2026-10-19;Não importar esta descrição;888\n",
    );
    let pending = ego_import::preview(&c, &file, "CSV", false).unwrap();
    cycle::archive_property(&mut c, &clock(), &first.id, true).unwrap();
    assert!(ego_import::apply(&mut c, &clock(), &pending, &pending.preview.token).is_err());
    let fresh = ego_import::preview(&c, &file, "CSV", false).unwrap();
    ego_import::apply(&mut c, &clock(), &fresh, &fresh.preview.token).unwrap();
    let p = cycle::property_by_ref(&c, "000001").unwrap().unwrap();
    assert!(p.archived);
    assert_eq!(
        p.original_description.as_deref(),
        Some("Descrição fictícia")
    );
    assert_eq!(cycle::properties(&c).unwrap().len(), 2);
    assert!(history::verify_chain(&c).unwrap().ok);
}
#[test]
fn invalid_rows_duplicate_refs_and_wrong_token_cannot_write() {
    let mut c = conn();
    let temp = tempfile::tempdir().unwrap();
    let file = temp.path().join("ego-teste.csv");
    csv_file(
        &file,
        "TESTE-01;TESTE;TESTE;TESTE;31/02/2026;;0\nTESTE-01;TESTE;TESTE;TESTE;;;0\nTESTE-02;TESTE;TESTE;TESTE;;;0\n",
    );
    let p = ego_import::preview(&c, &file, "CSV", false).unwrap();
    assert_eq!(p.preview.errors, 2);
    assert!(ego_import::apply(&mut c, &clock(), &p, &p.preview.token).is_err());
    assert!(cycle::properties(&c).unwrap().is_empty());
    csv_file(&file, "TESTE-01;TESTE;TESTE;TESTE;;;0\n");
    let p = ego_import::preview(&c, &file, "CSV", false).unwrap();
    assert!(ego_import::apply(&mut c, &clock(), &p, "token errado").is_err());
}
fn excel(path: &Path, numeric_reference: bool, formula: bool) {
    let buffer = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buffer);
    let options = zip::write::SimpleFileOptions::default();
    let entries = [
        (
            "[Content_Types].xml",
            r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>"#,
        ),
        (
            "_rels/.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"#,
        ),
        (
            "xl/workbook.xml",
            r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Imóveis TESTE" sheetId="1" r:id="rId1"/></sheets></workbook>"#,
        ),
        (
            "xl/_rels/workbook.xml.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>"#,
        ),
    ];
    for (name, content) in entries {
        zip.start_file(name, options).unwrap();
        zip.write_all(content.as_bytes()).unwrap();
    }
    let headers = [
        "Referência",
        "Natureza",
        "Disponibilidade",
        "Concelho",
        "Data de alteração",
        "Descrição",
    ];
    let mut cells = String::new();
    for (i, h) in headers.iter().enumerate() {
        cells.push_str(&format!(
            "<c r=\"{}1\" t=\"inlineStr\"><is><t>{h}</t></is></c>",
            (b'A' + i as u8) as char
        ));
    }
    let reference = if numeric_reference {
        "<c r=\"A2\"><v>1</v></c>"
    } else if formula {
        "<c r=\"A2\" t=\"str\"><f>CONCAT(\"000\",\"1\")</f><v>0001</v></c>"
    } else {
        "<c r=\"A2\" t=\"inlineStr\"><is><t>0001</t></is></c>"
    };
    let xml = format!(
        r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:F2"/><sheetData><row r="1">{cells}</row><row r="2">{reference}<c r="B2" t="inlineStr"><is><t>Moradia TESTE</t></is></c><c r="C2" t="inlineStr"><is><t>Disponível</t></is></c><c r="D2" t="inlineStr"><is><t>TESTE</t></is></c><c r="E2" t="inlineStr"><is><t>19/10/2026</t></is></c><c r="F2" t="inlineStr"><is><t>Descrição sintética</t></is></c></row></sheetData></worksheet>"#
    );
    zip.start_file("xl/worksheets/sheet1.xml", options).unwrap();
    zip.write_all(xml.as_bytes()).unwrap();
    zip.start_file("xl/vbaProject.bin", options).unwrap();
    zip.write_all(b"TESTE: conteudo inerte, nunca executar")
        .unwrap();
    std::fs::write(path, zip.finish().unwrap().into_inner()).unwrap();
}
#[test]
fn xlsm_preserves_text_refs_rejects_numeric_refs_and_formulas() {
    let c = conn();
    let temp = tempfile::tempdir().unwrap();
    let file = temp.path().join("ego-teste.xlsm");
    excel(&file, false, false);
    assert_eq!(ego_import::sheets(&file).unwrap(), vec!["Imóveis TESTE"]);
    let p = ego_import::preview(&c, &file, "Imóveis TESTE", false).unwrap();
    assert_eq!(p.preview.errors, 0);
    assert_eq!(p.preview.rows[0].input.ego_ref, "0001");
    excel(&file, true, false);
    let p = ego_import::preview(&c, &file, "Imóveis TESTE", false).unwrap();
    assert_eq!(p.preview.errors, 1);
    excel(&file, false, true);
    let p = ego_import::preview(&c, &file, "Imóveis TESTE", false).unwrap();
    assert_eq!(p.preview.errors, 1);
}
#[test]
fn encrypted_backup_restores_cycle_and_audit_draft() {
    let temp = tempfile::tempdir().unwrap();
    let output = tempfile::tempdir().unwrap();
    let clock = Arc::new(clock());
    let dd = DataDir::new(temp.path());
    let mut v = Vault::new(dd.clone(), clock.clone(), KdfParams::TESTING);
    let recovery = v.initialize("TESTE palavra-passe longa").unwrap().display();
    let p = property(v.conn_mut().unwrap());
    let l = listing(v.conn_mut().unwrap(), &p.id, "idealista-pt");
    cycle::record_audit(v.conn_mut().unwrap(), clock.as_ref(), &l.id, items()).unwrap();
    cycle::save_audit_draft(v.conn().unwrap(), clock.as_ref(), &l.id, items()).unwrap();
    let run =
        backup::backup_from_app(v.conn().unwrap(), &dd, clock.as_ref(), output.path()).unwrap();
    assert!(run.ok);
    let file = output.path().join(run.file_name.unwrap());
    let report = backup::verify_backup(&dd, &file, SecretKind::Recovery, &recovery).unwrap();
    assert_eq!(
        (report.properties, report.listings, report.issues),
        (1, 1, 1)
    );
    let bytes = std::fs::read(dd.db()).unwrap();
    assert_ne!(&bytes[..16], b"SQLite format 3\0");
    v.lock();
    let new_pc = tempfile::tempdir().unwrap();
    let restored = DataDir::new(new_pc.path());
    backup::restore(
        &restored,
        clock.as_ref(),
        &file,
        SecretKind::Recovery,
        &recovery,
    )
    .unwrap();
    let mut next = Vault::new(restored, clock, KdfParams::TESTING);
    next.unlock(SecretKind::Recovery, &recovery).unwrap();
    assert_eq!(cycle::properties(next.conn().unwrap()).unwrap().len(), 1);
    assert_eq!(cycle::issues(next.conn().unwrap(), None).unwrap().len(), 1);
    assert!(
        cycle::audit_draft(next.conn().unwrap(), &l.id)
            .unwrap()
            .is_some()
    );
    assert!(history::verify_chain(next.conn().unwrap()).unwrap().ok);
}

#[test]
fn foundation_upgrade_and_old_backup_preserve_settings_and_history() {
    use clara_core::{catalog, db, keys::KeyFile};
    let temp = tempfile::tempdir().unwrap();
    let output = tempfile::tempdir().unwrap();
    let dd = DataDir::new(temp.path());
    dd.ensure().unwrap();
    let clock = Arc::new(clock());
    let (keyfile, master, _) =
        KeyFile::create("TESTE palavra-passe longa", KdfParams::TESTING).unwrap();
    std::fs::write(dd.keys(), keyfile.to_json().unwrap()).unwrap();
    let mut old = db::open(&dd.db(), &master).unwrap();
    old.execute_batch("CREATE TABLE schema_migration(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)").unwrap();
    for migration in migrations::MIGRATIONS.iter().filter(|m| m.version <= 2) {
        old.execute_batch(migration.sql).unwrap();
        old.execute(
            "INSERT INTO schema_migration VALUES(?1,?2,'2026-10-18T12:00:00Z')",
            rusqlite::params![migration.version, migration.name],
        )
        .unwrap();
    }
    catalog::set_monitoring(&mut old, clock.as_ref(), "idealista-pt", true, None).unwrap();
    let events = history::count(&old).unwrap();
    let run = backup::backup_from_app(&old, &dd, clock.as_ref(), output.path()).unwrap();
    assert!(run.ok);
    let file = output.path().join(run.file_name.unwrap());
    drop(old);
    let report = backup::verify_backup(
        &dd,
        &file,
        SecretKind::Password,
        "TESTE palavra-passe longa",
    )
    .unwrap();
    assert_eq!(report.schema_version, 2);
    assert_eq!(report.properties, 0);
    assert_eq!(report.listings, 0);
    let mut upgraded = Vault::new(dd, clock.clone(), KdfParams::TESTING);
    upgraded
        .unlock(SecretKind::Password, "TESTE palavra-passe longa")
        .unwrap();
    assert_eq!(
        migrations::current_version(upgraded.conn().unwrap()).unwrap(),
        migrations::latest_version()
    );
    assert!(
        catalog::get(upgraded.conn().unwrap(), "idealista-pt")
            .unwrap()
            .monitoring_enabled
    );
    assert!(history::count(upgraded.conn().unwrap()).unwrap() > events);
    assert!(history::verify_chain(upgraded.conn().unwrap()).unwrap().ok);
    assert_eq!(
        cycle::properties(upgraded.conn().unwrap()).unwrap().len(),
        0
    );
    assert!(
        migrations::migrate(upgraded.conn_mut().unwrap(), clock.as_ref())
            .unwrap()
            .is_empty()
    );
}
#[test]
fn feed_only_destination_accepts_only_ego_edits() {
    let mut c = conn();
    let rm = clara_core::catalog::get(&c, "rightmove-pt").unwrap();
    assert_eq!(rm.grupo, "feed_only", "RightMove só recebe dados do EGO");
    let p = property(&mut c);
    let l = listing(&mut c, &p.id, "rightmove-pt");
    assert_eq!(l.portal_group, "feed_only");
    cycle::record_audit(&mut c, &clock(), &l.id, items()).unwrap();
    let issue = cycle::issues(&c, Some(&l.id)).unwrap().remove(0);
    assert!(cycle::record_change(&mut c, &clock(), &issue.id, "portal", "Planta", "TESTE").is_err());
    cycle::record_change(&mut c, &clock(), &issue.id, "ego", "Planta", "TESTE: editado no EGO").unwrap();
    // Outros destinos continuam a aceitar edição no portal; o grupo pode ser alterado.
    let after = clara_core::catalog::set_group(&mut c, &clock(), "idealista-pt", "feed_only").unwrap();
    assert_eq!(after.grupo, "feed_only");
    assert!(clara_core::catalog::set_group(&mut c, &clock(), "idealista-pt", "outro").is_err());
    assert!(history::verify_chain(&c).unwrap().ok);
}
