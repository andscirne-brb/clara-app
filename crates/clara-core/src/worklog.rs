//! Registo local único. A exportação para o XLSM é confirmada separadamente.
use crate::{
    ClaraError, Result,
    clock::{Clock, ts},
    cycle,
    history::{self, Actor, NewEvent},
    settings,
};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Work {
    pub id: String,
    pub date: String,
    pub reference: String,
    pub author: String,
    pub location: String,
    pub field: String,
    pub before: String,
    pub after: String,
    pub reason: String,
    pub verification: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Entry {
    pub data: Work,
    pub created_at: String,
    pub written_at: Option<String>,
    #[serde(default)]
    pub cancelled_at: Option<String>,
}
fn key(id: &str) -> Result<String> {
    uuid::Uuid::parse_str(id)
        .map_err(|_| ClaraError::Invalid("Identificação do registo inválida.".into()))?;
    Ok(format!("worklog:{id}"))
}
pub fn form_get(c: &Connection) -> Result<Option<Work>> {
    settings::get(c, "work_form")?
        .map(|v| serde_json::from_str(&v).map_err(Into::into))
        .transpose()
}
pub fn form_save(c: &Connection, clock: &dyn Clock, data: &Work) -> Result<()> {
    key(&data.id)?;
    let text = serde_json::to_string(data)?;
    if text.len() > 20000 {
        return Err(ClaraError::Invalid("Rascunho demasiado grande.".into()));
    }
    settings::put(c, clock, "work_form", &text)
}
pub fn get(c: &Connection, id: &str) -> Result<Option<Entry>> {
    settings::get(c, &key(id)?)?
        .map(|v| serde_json::from_str(&v).map_err(Into::into))
        .transpose()
}
pub fn list(c: &Connection) -> Result<Vec<Entry>> {
    let mut q=c.prepare("SELECT value FROM app_setting WHERE key LIKE 'worklog:%' ORDER BY updated_at DESC LIMIT 1000")?;
    q.query_map([], |r| r.get::<_, String>(0))?
        .map(|v| Ok(serde_json::from_str(&v?)?))
        .collect()
}
pub fn save(c: &mut Connection, clock: &dyn Clock, data: Work) -> Result<Entry> {
    key(&data.id)?;
    let date = chrono::NaiveDate::parse_from_str(&data.date, "%Y-%m-%d")
        .map_err(|_| ClaraError::Invalid("Data inválida.".into()))?;
    if date > clock.now().with_timezone(&crate::TZ).date_naive() {
        return Err(ClaraError::Invalid(
            "A data do trabalho não pode ser futura.".into(),
        ));
    }
    for (value, label, max, required) in [
        (&data.reference, "referência", 100, true),
        (&data.author, "autor", 150, true),
        (&data.location, "local", 200, true),
        (&data.field, "campo", 300, true),
        (&data.before, "antes", 4000, false),
        (&data.after, "trabalho realizado", 4000, true),
        (&data.reason, "fonte", 2000, false),
    ] {
        cycle::text(value, label, max, required)?;
    }
    if !["Por verificar", "Confirmado", "Falhou", "Não aplicável"]
        .contains(&data.verification.as_str())
    {
        return Err(ClaraError::Invalid(
            "Estado de verificação inválido.".into(),
        ));
    }
    if let Some(old) = get(c, &data.id)? {
        if old.data == data {
            return Ok(old);
        }
        return Err(ClaraError::Invalid(
            "Este registo já existe. Regista uma correção separada para preservar o histórico."
                .into(),
        ));
    }
    let entry = Entry {
        data,
        created_at: ts(clock.now()),
        written_at: None,
        cancelled_at: None,
    };
    let tx = c.transaction()?;
    settings::put(
        &tx,
        clock,
        &key(&entry.data.id)?,
        &serde_json::to_string(&entry)?,
    )?;
    if form_get(&tx)?.is_some_and(|d| d.id == entry.data.id) {
        tx.execute("DELETE FROM app_setting WHERE key='work_form'", [])?;
    }
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(&entry.data.reference),
            "trabalho.registado",
            "Trabalho guardado; aguarda gravação no levantamento",
        ),
    )?;
    tx.commit()?;
    Ok(entry)
}
pub fn mark_written(c: &mut Connection, clock: &dyn Clock, id: &str) -> Result<()> {
    let mut entry =
        get(c, id)?.ok_or_else(|| ClaraError::Invalid("Registo não encontrado.".into()))?;
    if entry.cancelled_at.is_some() {
        return Err(ClaraError::Invalid(
            "Este registo foi arquivado sem envio.".into(),
        ));
    }
    if entry.written_at.is_some() {
        return Ok(());
    }
    entry.written_at = Some(ts(clock.now()));
    let tx = c.transaction()?;
    settings::put(&tx, clock, &key(id)?, &serde_json::to_string(&entry)?)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(&entry.data.reference),
            "trabalho.exportado",
            "Registo gravado no XLSM local; sincronização do Drive por confirmar",
        ),
    )?;
    tx.commit()?;
    Ok(())
}
pub fn cancel(c: &mut Connection, clock: &dyn Clock, id: &str) -> Result<()> {
    let mut entry =
        get(c, id)?.ok_or_else(|| ClaraError::Invalid("Registo não encontrado.".into()))?;
    if entry.written_at.is_some() {
        return Err(ClaraError::Invalid(
            "O registo já está no Excel. Regista uma correção separada.".into(),
        ));
    }
    if entry.cancelled_at.is_some() {
        return Ok(());
    }
    entry.cancelled_at = Some(ts(clock.now()));
    let tx = c.transaction()?;
    settings::put(&tx, clock, &key(id)?, &serde_json::to_string(&entry)?)?;
    history::record(
        &tx,
        clock,
        Actor::Andreia,
        NewEvent::new(
            "property",
            Some(&entry.data.reference),
            "trabalho.arquivado",
            "Registo arquivado antes de gravar no Excel; histórico preservado",
        ),
    )?;
    tx.commit()?;
    Ok(())
}
