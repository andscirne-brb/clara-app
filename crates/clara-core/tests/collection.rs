use clara_core::{
    clock::FixedClock,
    collection::{self, Collection, Content},
    cycle::{self, PropertyInput},
    history, migrations,
};
use rusqlite::Connection;
fn data() -> Collection {
    Collection {
        source: "Ficha manual TESTE".into(),
        contents: ["PT", "EN", "FR", "DE", "ES"]
            .iter()
            .map(|l| Content {
                language: l.to_string(),
                title: format!("Título TESTE {l}"),
                description: "Cozinha equipada. Cinco varandas.".into(),
                reviewed: true,
            })
            .collect(),
        captures: vec![],
        selected_features: vec![],
        feature_list_reviewed: true,
        notes: "Visita virtual: não aplicável.".into(),
    }
}
#[test]
fn original_versions_survive_edits_and_migration_is_repeatable() {
    let clock = FixedClock::new("2026-10-19T12:00:00Z".parse().unwrap());
    let mut c = Connection::open_in_memory().unwrap();
    c.execute_batch("PRAGMA foreign_keys=ON").unwrap();
    migrations::migrate(&mut c, &clock).unwrap();
    assert!(migrations::migrate(&mut c, &clock).unwrap().is_empty());
    let p = cycle::create_property(
        &mut c,
        &clock,
        PropertyInput {
            ego_ref: "TESTE-0001".into(),
            nature: "Moradia TESTE".into(),
            municipality: "TESTE".into(),
            availability: "".into(),
            ego_modified: "".into(),
        },
    )
    .unwrap();
    let first = collection::save(&mut c, &clock, &p.id, data()).unwrap();
    let mut next = data();
    next.contents[0].title = "Nova versão TESTE".into();
    next.source.clear();
    collection::draft_save(&c, &clock, &p.id, &next).unwrap();
    assert_eq!(
        collection::draft_get(&c, &p.id).unwrap().unwrap().contents[0].title,
        "Nova versão TESTE"
    );
    assert_eq!(collection::list(&c, &p.id).unwrap().len(), 1);
    next.source = "Ficha TESTE".into();
    collection::save(&mut c, &clock, &p.id, next).unwrap();
    assert!(collection::draft_get(&c, &p.id).unwrap().is_none());
    let versions = collection::list(&c, &p.id).unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[1].id, first.id);
    assert_eq!(versions[1].data.contents[0].title, "Título TESTE PT");
    assert_eq!(versions[0].data.contents[0].title, "Nova versão TESTE");
    assert!(history::verify_chain(&c).unwrap().ok);
    let mut invalid = data();
    invalid.contents[1].language = "PT".into();
    assert!(collection::save(&mut c, &clock, &p.id, invalid).is_err());
    assert_eq!(collection::list(&c, &p.id).unwrap().len(), 2);
    assert!(collection::save(&mut c, &clock, "inexistente", data()).is_err());
}
