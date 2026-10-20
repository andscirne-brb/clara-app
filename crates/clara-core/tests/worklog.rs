use clara_core::{
    clock::FixedClock,
    history, migrations,
    worklog::{self, Work},
};
#[test]
fn work_is_immutable_idempotent_and_draft_survives_reopening() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("TESTE.db");
    let clock = FixedClock::new("2026-10-20T12:00:00Z".parse().unwrap());
    let data = Work {
        id: uuid::Uuid::new_v4().to_string(),
        date: "2026-10-20".into(),
        reference: "TESTE-01".into(),
        author: "TESTE".into(),
        location: "eGO".into(),
        field: "Planta".into(),
        before: "".into(),
        after: "Planta TESTE anexada".into(),
        reason: "Evidência TESTE".into(),
        verification: "Por verificar".into(),
    };
    {
        let mut c = rusqlite::Connection::open(&path).unwrap();
        migrations::migrate(&mut c, &clock).unwrap();
        worklog::form_save(&c, &clock, &data).unwrap();
    }
    let mut c = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(worklog::form_get(&c).unwrap().unwrap(), data);
    let saved = worklog::save(&mut c, &clock, data.clone()).unwrap();
    assert!(saved.written_at.is_none());
    assert!(worklog::form_get(&c).unwrap().is_none());
    worklog::save(&mut c, &clock, data.clone()).unwrap();
    assert_eq!(worklog::list(&c).unwrap().len(), 1);
    let mut changed = data.clone();
    changed.after = "Outra coisa".into();
    assert!(worklog::save(&mut c, &clock, changed).is_err());
    let mut future = data.clone();
    future.id = uuid::Uuid::new_v4().to_string();
    future.date = "2026-10-21".into();
    assert!(worklog::save(&mut c, &clock, future).is_err());
    worklog::mark_written(&mut c, &clock, &data.id).unwrap();
    worklog::mark_written(&mut c, &clock, &data.id).unwrap();
    assert!(
        worklog::get(&c, &data.id)
            .unwrap()
            .unwrap()
            .written_at
            .is_some()
    );
    assert!(worklog::cancel(&mut c, &clock, &data.id).is_err());
    let other = Work {
        id: uuid::Uuid::new_v4().to_string(),
        ..data.clone()
    };
    worklog::save(&mut c, &clock, other.clone()).unwrap();
    worklog::cancel(&mut c, &clock, &other.id).unwrap();
    assert_eq!(worklog::get(&c, &other.id).unwrap().unwrap().data, other);
    assert!(
        worklog::get(&c, &other.id)
            .unwrap()
            .unwrap()
            .cancelled_at
            .is_some()
    );
    assert!(worklog::mark_written(&mut c, &clock, &other.id).is_err());
    assert!(history::verify_chain(&c).unwrap().ok);
}
