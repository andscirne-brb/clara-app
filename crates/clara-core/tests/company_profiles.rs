use clara_core::{
    clock::FixedClock,
    company_profiles::{self, Item, Profile, Text},
    history, migrations,
};
fn data() -> Profile {
    Profile {
        portal: "idealista".into(),
        url: "https://example.invalid/perfil".into(),
        stage: "Em curso".into(),
        source: "Consulta TESTE".into(),
        next_action: "Rever texto TESTE".into(),
        sara: "".into(),
        applied_date: "".into(),
        applied_confirmed: false,
        texts: ["PT", "EN", "FR", "ES", "DE"]
            .iter()
            .map(|l| Text {
                language: (*l).into(),
                original: format!("Original TESTE {l}"),
                proposed: "".into(),
            })
            .collect(),
        items: company_profiles::FIELDS
            .iter()
            .map(|f| Item {
                field: (*f).into(),
                state: "Por verificar".into(),
                note: "".into(),
            })
            .collect(),
    }
}
#[test]
fn drafts_resume_versions_preserve_originals_and_save_is_idempotent() {
    let clock = FixedClock::new("2026-10-20T12:00:00Z".parse().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("TESTE.db");
    let mut c = rusqlite::Connection::open(&path).unwrap();
    migrations::migrate(&mut c, &clock).unwrap();
    let mut p = data();
    p.url = "htt".into();
    company_profiles::draft_save(&c, &clock, &p).unwrap();
    drop(c);
    let mut c = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(
        company_profiles::draft(&c, "idealista")
            .unwrap()
            .unwrap()
            .url,
        "htt"
    );
    assert!(company_profiles::save(&mut c, &clock, p.clone()).is_err());
    p.url = "https://example.invalid/perfil".into();
    let first = company_profiles::save(&mut c, &clock, p.clone()).unwrap();
    assert_eq!(
        company_profiles::save(&mut c, &clock, p.clone())
            .unwrap()
            .id,
        first.id
    );
    p.texts[3].proposed = "Proposta ES TESTE".into();
    let second = company_profiles::save(&mut c, &clock, p).unwrap();
    let all = company_profiles::versions(&c, "idealista").unwrap();
    assert_eq!(all.len(), 2);
    assert_eq!(all[0].id, second.id);
    assert_eq!(all[1].data.texts[3].original, "Original TESTE ES");
    assert!(all[1].data.texts[3].proposed.is_empty());
    assert_eq!(all[0].data.texts[4].language, "DE");
    assert!(
        company_profiles::versions(&c, "rightmove")
            .unwrap()
            .is_empty()
    );
    assert!(history::verify_chain(&c).unwrap().ok);
}
#[test]
fn publication_requires_human_evidence_and_valid_scope() {
    let clock = FixedClock::new("2026-10-20T12:00:00Z".parse().unwrap());
    let mut p = data();
    p.stage = "Aplicado e conferido".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
    p.applied_date = "2026-10-20".into();
    p.applied_confirmed = true;
    for i in &mut p.items {
        i.state = "Conferido".into();
    }
    assert!(company_profiles::validate(&p, &clock, true).is_ok());
    p.items[0].state = "Não aplicável".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
    p.items[0].note = "Não existe este campo no portal TESTE".into();
    assert!(company_profiles::validate(&p, &clock, true).is_ok());
    p.url = "javascript:alert(1)".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
    p.url = "https://user:secret@example.invalid/".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
    p = data();
    p.texts[4].language = "ES".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
    p = data();
    p.portal = "outro".into();
    assert!(company_profiles::validate(&p, &clock, true).is_err());
}
