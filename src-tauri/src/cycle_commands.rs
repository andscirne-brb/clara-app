use crate::AppState;
use clara_core::{
    cycle::{self, Audit, AuditItem, Issue, Listing, ListingInput, Property, PropertyInput},
    ego_import::{self, ImportResult, PendingImport, Preview},
};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
type Res<T> = Result<T, String>;
#[derive(Default)]
pub struct ImportSession {
    pub path: Option<PathBuf>,
    pub pending: Option<PendingImport>,
}
#[derive(Serialize)]
pub struct Inventory {
    properties: Vec<Property>,
    listings: Vec<Listing>,
    issues: Vec<Issue>,
}
#[tauri::command]
pub async fn inventory(state: State<'_, AppState>) -> Res<Inventory> {
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    Ok(Inventory {
        properties: cycle::properties(c).map_err(|e| e.to_string())?,
        listings: cycle::listings(c).map_err(|e| e.to_string())?,
        issues: cycle::issues(c, None).map_err(|e| e.to_string())?,
    })
}
#[tauri::command]
pub async fn property_create(state: State<'_, AppState>, input: PropertyInput) -> Res<Property> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::create_property(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        input,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn property_archive(
    state: State<'_, AppState>,
    id: String,
    archived: bool,
) -> Res<Property> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::archive_property(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &id,
        archived,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn listing_save(
    state: State<'_, AppState>,
    id: Option<String>,
    input: ListingInput,
) -> Res<Listing> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::save_listing(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        id,
        input,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn audits_list(state: State<'_, AppState>, listing_id: String) -> Res<Vec<Audit>> {
    let v = state.vault.lock().unwrap();
    cycle::audits(v.conn().map_err(|e| e.to_string())?, &listing_id).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn audit_draft_get(
    state: State<'_, AppState>,
    listing_id: String,
) -> Res<Option<Vec<AuditItem>>> {
    let v = state.vault.lock().unwrap();
    cycle::audit_draft(v.conn().map_err(|e| e.to_string())?, &listing_id).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn audit_draft_save(
    state: State<'_, AppState>,
    listing_id: String,
    items: Vec<AuditItem>,
) -> Res<()> {
    state.touch();
    let v = state.vault.lock().unwrap();
    cycle::save_audit_draft(
        v.conn().map_err(|e| e.to_string())?,
        v.clock(),
        &listing_id,
        items,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn audit_record(
    state: State<'_, AppState>,
    listing_id: String,
    items: Vec<AuditItem>,
) -> Res<String> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::record_audit(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &listing_id,
        items,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn change_record(
    state: State<'_, AppState>,
    issue_id: String,
    edit_location: String,
    fields: String,
    reason: String,
) -> Res<String> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::record_change(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &issue_id,
        &edit_location,
        &fields,
        &reason,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn qa_record(
    state: State<'_, AppState>,
    change_id: String,
    result: String,
    observed_url: String,
    note: String,
) -> Res<String> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    cycle::record_qa(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &change_id,
        &result,
        &observed_url,
        &note,
    )
    .map_err(|e| e.to_string())
}
#[derive(Serialize)]
pub struct PickedImport {
    file_name: String,
    sheets: Vec<String>,
}
#[tauri::command]
pub async fn ego_pick_file(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Res<Option<PickedImport>> {
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    state.touch();
    let chosen = app
        .dialog()
        .file()
        .set_title("Escolhe a exportação EGO")
        .add_filter("Excel ou CSV", &["xlsm", "xlsx", "csv"])
        .blocking_pick_file();
    let v = state.vault.lock().unwrap();
    v.conn().map_err(|e| e.to_string())?;
    let mut session = state.ego_import.lock().unwrap();
    *session = ImportSession::default();
    let Some(chosen) = chosen else {
        return Ok(None);
    };
    let path = chosen
        .into_path()
        .map_err(|_| "Não foi possível aceder ao ficheiro escolhido.".to_string())?;
    let sheets = ego_import::sheets(&path).map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    session.path = Some(path);
    Ok(Some(PickedImport { file_name, sheets }))
}
#[tauri::command]
pub async fn ego_preview(
    state: State<'_, AppState>,
    sheet: String,
    include_description: bool,
) -> Res<Preview> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let conn = v.conn().map_err(|e| e.to_string())?;
    let mut session = state.ego_import.lock().unwrap();
    session.pending = None;
    let path = session
        .path
        .as_ref()
        .ok_or("Escolhe primeiro um ficheiro EGO.")?;
    let pending =
        ego_import::preview(conn, path, &sheet, include_description).map_err(|e| e.to_string())?;
    let result = pending.preview.clone();
    session.pending = Some(pending);
    Ok(result)
}
#[tauri::command]
pub async fn ego_apply(state: State<'_, AppState>, token: String) -> Res<ImportResult> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let conn = v.conn_mut().map_err(|e| e.to_string())?;
    let mut session = state.ego_import.lock().unwrap();
    let pending = session
        .pending
        .as_ref()
        .ok_or("A pré-visualização expirou. Volta a carregar o ficheiro.")?;
    let result =
        ego_import::apply(conn, clock.as_ref(), pending, &token).map_err(|e| e.to_string())?;
    *session = ImportSession::default();
    Ok(result)
}
#[tauri::command]
pub async fn ego_cancel(state: State<'_, AppState>) -> Res<()> {
    let v = state.vault.lock().unwrap();
    v.conn().map_err(|e| e.to_string())?;
    *state.ego_import.lock().unwrap() = ImportSession::default();
    Ok(())
}
