use crate::AppState;
use clara_core::collection::{self, Collection, Snapshot, Suggestion};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
type Res<T> = Result<T, String>;
#[tauri::command]
pub async fn collection_draft_get(
    state: State<'_, AppState>,
    property_id: String,
) -> Res<Option<Collection>> {
    let v = state.vault.lock().unwrap();
    collection::draft_get(v.conn().map_err(|e| e.to_string())?, &property_id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn collection_draft_save(
    state: State<'_, AppState>,
    property_id: String,
    data: Collection,
) -> Res<()> {
    state.touch();
    let v = state.vault.lock().unwrap();
    collection::draft_save(
        v.conn().map_err(|e| e.to_string())?,
        v.clock(),
        &property_id,
        &data,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn collection_list(
    state: State<'_, AppState>,
    property_id: String,
) -> Res<Vec<Snapshot>> {
    let v = state.vault.lock().unwrap();
    collection::list(v.conn().map_err(|e| e.to_string())?, &property_id).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn collection_save(
    state: State<'_, AppState>,
    property_id: String,
    data: Collection,
) -> Res<Snapshot> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    collection::save(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &property_id,
        data,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn collection_suggestions(
    state: State<'_, AppState>,
    data: Collection,
) -> Res<Vec<Suggestion>> {
    let v = state.vault.lock().unwrap();
    v.conn().map_err(|e| e.to_string())?;
    if serde_json::to_vec(&data).map_err(|e| e.to_string())?.len() > 5000000 {
        return Err("Recolha demasiado grande.".into());
    }
    Ok(collection::suggestions(&data))
}
#[derive(serde::Serialize)]
pub struct OcrCapture {
    name: String,
    text: String,
}
#[tauri::command]
pub async fn collection_capture(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Res<Option<OcrCapture>> {
    state.touch();
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    let file = app
        .dialog()
        .file()
        .add_filter("Captura PNG ou JPEG", &["png", "jpg", "jpeg"])
        .blocking_pick_file();
    let Some(file) = file else { return Ok(None) };
    let path = file.into_path().map_err(|_| "Escolhe um ficheiro local.")?;
    if !matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg"
    ) {
        return Err("Usa PNG ou JPEG.".into());
    }
    if std::fs::metadata(&path)
        .map_err(|_| "Não foi possível ler a captura.")?
        .len()
        > 30000000
    {
        return Err("Captura acima de 30 MB. Divide-a em partes.".into());
    }
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let text = tauri::async_runtime::spawn_blocking(move || read_ocr(&path))
        .await
        .map_err(|_| "A leitura foi interrompida.")??;
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    Ok(Some(OcrCapture { name, text }))
}
#[cfg(windows)]
fn read_ocr(path: &std::path::Path) -> Res<String> {
    use std::{
        io::Write,
        os::windows::process::CommandExt,
        process::{Command, Stdio},
    };
    let shell = std::path::PathBuf::from(
        std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
    )
    .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(shell)
        .args(["-NoProfile", "-NonInteractive", "-Command", "-"])
        .env("CLARA_OCR_PATH", path)
        .creation_flags(0x08000000)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Não foi possível iniciar a leitura local.")?;
    child
        .stdin
        .take()
        .ok_or("Leitura indisponível.")?
        .write_all(include_bytes!("ocr.ps1"))
        .map_err(|_| "Leitura interrompida.")?;
    let output = child
        .wait_with_output()
        .map_err(|_| "Leitura interrompida.")?;
    if !output.status.success() {
        return Err("Não foi possível ler esta imagem. Confirma os idiomas OCR instalados no Windows; podes sempre colar o texto manualmente.".into());
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(raw.trim().trim_start_matches('\u{feff}'))
        .map_err(|_| "A leitura não devolveu texto válido.")?;
    let text = json["text"].as_str().ok_or("Não foi encontrado texto.")?;
    if text.len() > 150000 {
        return Err("Texto demasiado extenso; divide a captura.".into());
    }
    Ok(text.into())
}
#[cfg(not(windows))]
fn read_ocr(_: &std::path::Path) -> Res<String> {
    Err("Leitura de imagens disponível no Windows. Cola o texto para continuar.".into())
}
