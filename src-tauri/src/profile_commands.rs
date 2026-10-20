use crate::AppState;
use clara_core::company_profiles::{self, Profile, Version};
use tauri::State;
type Res<T> = Result<T, String>;
#[tauri::command]
pub async fn company_profile_draft(
    state: State<'_, AppState>,
    portal: String,
) -> Res<Option<Profile>> {
    state.touch();
    let v = state.vault.lock().unwrap();
    company_profiles::draft(v.conn().map_err(|e| e.to_string())?, &portal)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn company_profile_draft_save(state: State<'_, AppState>, data: Profile) -> Res<()> {
    state.touch();
    let v = state.vault.lock().unwrap();
    company_profiles::draft_save(v.conn().map_err(|e| e.to_string())?, v.clock(), &data)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn company_profile_versions(
    state: State<'_, AppState>,
    portal: String,
) -> Res<Vec<Version>> {
    state.touch();
    let v = state.vault.lock().unwrap();
    company_profiles::versions(v.conn().map_err(|e| e.to_string())?, &portal)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn company_profile_save(state: State<'_, AppState>, data: Profile) -> Res<Version> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    company_profiles::save(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        data,
    )
    .map_err(|e| e.to_string())
}
