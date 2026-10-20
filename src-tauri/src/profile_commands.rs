use crate::AppState;
use clara_core::company_profiles::{self, Profile, Version};
use tauri::State;
type Res<T> = Result<T, String>;
#[tauri::command]
pub async fn company_profile_sync(
    state: State<'_, AppState>,
    portal: String,
) -> Res<crate::work_commands::Written> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    let path = clara_core::settings::get(c, clara_core::weekly::PATH_KEY).map_err(|e|e.to_string())?
        .ok_or("A versão está guardada na Clara. Escolhe o levantamento principal em Resumo semanal e volta a guardar para atualizar o Excel.")?;
    let versions = company_profiles::versions_for_excel(c, &portal).map_err(|e| e.to_string())?;
    let latest = versions
        .first()
        .ok_or("Guarda uma versão antes de atualizar o Excel.")?;
    let hash =
        clara_core::weekly::fingerprint(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
    crate::work_commands::write_request(
        serde_json::json!({"path":path,"expected_hash":hash,"profiles":versions,"work":{"id":latest.id}}),
    )
}
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
