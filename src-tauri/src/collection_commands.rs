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
pub(crate) fn read_ocr(path: &std::path::Path) -> Res<String> {
    parse_ocr_output(&run_ocr_program(path, include_str!("ocr.ps1"))?)
}
#[cfg(windows)]
fn run_ocr_program(path: &std::path::Path, program: &str) -> Res<Vec<u8>> {
    use std::{
        os::windows::process::CommandExt,
        process::{Command, Stdio},
    };
    let shell = std::path::PathBuf::from(
        std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
    )
    .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    // Run the complete fixed program. Streaming compound statements with -Command -
    // can exit successfully before the final block executes, producing no JSON.
    // Only trusted program text is encoded; the image path remains an environment value.
    let bytes: Vec<u8> = program.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let encoded = crate::work_commands::encode_base64(&bytes);
    let output = Command::new(shell)
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
        .env("CLARA_OCR_PATH", path)
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|_| "Não foi possível iniciar a leitura local.")?;
    if !output.status.success() {
        return Err("Não foi possível ler esta imagem. Confirma os idiomas OCR instalados no Windows; podes sempre colar o texto manualmente.".into());
    }
    Ok(output.stdout)
}
fn parse_ocr_output(bytes: &[u8]) -> Res<String> {
    let raw = std::str::from_utf8(bytes)
        .map_err(|_| "A leitura devolveu uma resposta com codificação inválida.")?;
    let raw = raw.trim().trim_start_matches('\u{feff}').trim();
    if raw.is_empty() {
        return Err("O leitor não devolveu uma resposta. A imagem não foi acrescentada; volta a tentar a leitura.".into());
    }
    let json: serde_json::Value =
        serde_json::from_str(raw).map_err(|_| "A leitura não devolveu texto válido.")?;
    let text = json["text"]
        .as_str()
        .ok_or("O leitor não devolveu o campo de texto esperado.")?;
    if text.len() > 150000 {
        return Err("Texto demasiado extenso; divide a captura.".into());
    }
    Ok(text.into())
}
#[cfg(not(windows))]
pub(crate) fn read_ocr(_: &std::path::Path) -> Res<String> {
    Err("Leitura de imagens disponível no Windows. Cola o texto para continuar.".into())
}

#[cfg(test)]
mod ocr_tests {
    #[test]
    fn response_parser_rejects_missing_truncated_and_invalid_output() {
        for bytes in [
            b"".as_slice(),
            b"   ",
            b"not json",
            b"{",
            b"{}",
            b"{\"text\":7}",
            b"\xff",
        ] {
            assert!(super::parse_ocr_output(bytes).is_err());
        }
        assert_eq!(
            super::parse_ocr_output("\u{feff} {\"text\":\"Descrição de teste\"} ".as_bytes())
                .unwrap(),
            "Descrição de teste"
        );
        assert!(
            super::parse_ocr_output(
                serde_json::json!({"text":"x".repeat(150001)})
                    .to_string()
                    .as_bytes()
            )
            .is_err()
        );
    }
    #[cfg(windows)]
    #[test]
    fn complete_ocr_program_runs_final_block_without_streaming_stdin() {
        let path = std::path::Path::new("C:\\Capturas TESTE\\imagem com espaço ' e $dados.png");
        let program = r#"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$prefix='TESTE'
try {
 @{text=($prefix+' '+$env:CLARA_OCR_PATH)} | ConvertTo-Json -Compress
} finally {
}
"#;
        let bytes = super::run_ocr_program(path, program).unwrap();
        assert_eq!(
            super::parse_ocr_output(&bytes).unwrap(),
            format!("TESTE {}", path.display())
        );
    }
}
