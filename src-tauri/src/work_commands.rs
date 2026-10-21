use crate::AppState;
use clara_core::{
    settings, weekly,
    worklog::{self, Entry, Work},
};
use tauri::State;
type Res<T> = Result<T, String>;
#[tauri::command]
pub async fn workbook_changes_preview(
    state: State<'_, AppState>,
) -> Res<clara_core::workbook_changes::Review> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    let p = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal em Resumo semanal.")?;
    clara_core::workbook_changes::preview(c, v.clock(), std::path::Path::new(&p))
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn workbook_changes_accept(state: State<'_, AppState>, token: String) -> Res<()> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let c = v.conn_mut().map_err(|e| e.to_string())?;
    let p = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal em Resumo semanal.")?;
    clara_core::workbook_changes::accept(c, clock.as_ref(), std::path::Path::new(&p), &token)
        .map_err(|e| e.to_string())
}
#[derive(serde::Serialize)]
pub struct Overview {
    file_name: Option<String>,
    file_error: Option<String>,
    properties: Vec<weekly::TrackerProperty>,
    entries: Vec<Entry>,
    form: Option<Work>,
    last_property_ref: Option<String>,
    today: String,
}
#[tauri::command]
pub async fn work_overview(state: State<'_, AppState>) -> Res<Overview> {
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    let path = settings::get(c, weekly::PATH_KEY).map_err(|e| e.to_string())?;
    let (mut properties, mut file_error) = (vec![], None);
    if let Some(p) = &path {
        match weekly::tracker(std::path::Path::new(p), v.clock()) {
            Ok(r) => properties = r,
            Err(e) => file_error = Some(e.to_string()),
        }
    }
    Ok(Overview {
        file_name: path.and_then(|p| {
            std::path::Path::new(&p)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
        }),
        file_error,
        properties,
        entries: worklog::list(c).map_err(|e| e.to_string())?,
        form: worklog::form_get(c).map_err(|e| e.to_string())?,
        last_property_ref: settings::get(c, "last_property_ref").map_err(|e| e.to_string())?,
        today: v
            .clock()
            .now()
            .with_timezone(&clara_core::TZ)
            .date_naive()
            .to_string(),
    })
}
#[tauri::command]
pub async fn work_draft_save(state: State<'_, AppState>, data: Work) -> Res<()> {
    state.touch();
    let v = state.vault.lock().unwrap();
    worklog::form_save(v.conn().map_err(|e| e.to_string())?, v.clock(), &data)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn work_cancel(state: State<'_, AppState>, id: String) -> Res<()> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    worklog::cancel(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &id,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn work_save(state: State<'_, AppState>, data: Work) -> Res<Entry> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let c = v.conn_mut().map_err(|e| e.to_string())?;
    let path = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe primeiro o levantamento principal em Resumo semanal.")?;
    if !weekly::tracker(std::path::Path::new(&path), clock.as_ref())
        .map_err(|e| e.to_string())?
        .iter()
        .any(|p| p.reference == data.reference)
    {
        return Err("Escolhe uma referência existente no levantamento.".into());
    }
    worklog::save(c, clock.as_ref(), data).map_err(|e| e.to_string())
}
#[derive(serde::Serialize)]
pub struct Preview {
    id: String,
    hash: String,
    file_name: String,
}
#[tauri::command]
pub async fn work_preview(state: State<'_, AppState>, id: String) -> Res<Preview> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    worklog::get(c, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Registo não encontrado.")?;
    let path = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal.")?;
    let p = std::path::Path::new(&path);
    Ok(Preview {
        id,
        hash: weekly::fingerprint(p).map_err(|e| e.to_string())?,
        file_name: p
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
    })
}
#[derive(serde::Serialize, serde::Deserialize)]
pub struct Written {
    pub file_name: String,
    pub already_written: bool,
    pub recovery_file: Option<String>,
}
pub fn write_workbook(path: &std::path::Path, hash: &str, data: &Work) -> Res<Written> {
    write_request(serde_json::json!({"path":path,"expected_hash":hash,"work":data}))
}
pub fn write_request(request: serde_json::Value) -> Res<Written> {
    #[cfg(windows)]
    {
        use std::{
            io::Write,
            os::windows::process::CommandExt,
            process::{Command, Stdio},
        };
        let shell = std::path::PathBuf::from(
            std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
        )
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let script = format!(
            "$ProgressPreference='SilentlyContinue';[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);{}",
            if request.get("profiles").is_some() {
                include_str!("profiles-write.ps1")
            } else {
                include_str!("workbook-write.ps1")
            }
        );
        // EncodedCommand carries fixed program text, never user data; JSON goes through stdin.
        let wrapper = "[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);& ([scriptblock]::Create($env:CLARA_WRITER_SCRIPT))";
        let bytes: Vec<u8> = wrapper.encode_utf16().flat_map(u16::to_le_bytes).collect();
        let encoded = encode_base64(&bytes);
        let mut child = Command::new(shell)
            .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
            .env("CLARA_WRITER_SCRIPT", script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|_| "Não foi possível iniciar a gravação local.")?;
        child
            .stdin
            .take()
            .ok_or("Gravação indisponível.")?
            .write_all(&serde_json::to_vec(&request).map_err(|e| e.to_string())?)
            .map_err(|_| "A gravação foi interrompida.")?;
        let out = child
            .wait_with_output()
            .map_err(|_| "A gravação foi interrompida.")?;
        if !out.status.success() {
            return Err(format!(
                "Não foi possível gravar no Excel. O registo continua guardado na Clara. Atualiza a pré-visualização antes de repetir. Se o Excel estiver aberto, fecha-o primeiro. {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        serde_json::from_slice(&out.stdout).map_err(|_|"A gravação não devolveu confirmação. Atualiza e repete a mesma operação; os registos não serão duplicados.".into())
    }
    #[cfg(not(windows))]
    {
        let _ = request;
        Err("Gravação do XLSM disponível apenas no Windows.".into())
    }
}
#[cfg(windows)]
pub(crate) fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::new();
    for c in bytes.chunks(3) {
        let n = ((c[0] as u32) << 16)
            | ((c.get(1).copied().unwrap_or(0) as u32) << 8)
            | c.get(2).copied().unwrap_or(0) as u32;
        for i in 0..4 {
            if i > c.len() {
                s.push('=')
            } else {
                s.push(TABLE[((n >> (18 - i * 6)) & 63) as usize] as char)
            }
        }
    }
    s
}
#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn command_encoding_handles_padding() {
        for (input, expected) in [
            (b"".as_slice(), ""),
            (b"f".as_slice(), "Zg=="),
            (b"fo".as_slice(), "Zm8="),
            (b"foo".as_slice(), "Zm9v"),
        ] {
            assert_eq!(super::encode_base64(input), expected)
        }
    }
}
#[tauri::command]
pub async fn work_export(
    state: State<'_, AppState>,
    id: String,
    expected_hash: String,
) -> Res<Written> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let c = v.conn_mut().map_err(|e| e.to_string())?;
    let entry = worklog::get(c, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Registo não encontrado.")?;
    if entry.cancelled_at.is_some() {
        return Err("Este registo foi arquivado sem envio.".into());
    }
    if expected_hash.len() != 64 || !expected_hash.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Atualiza a pré-visualização antes de confirmar.".into());
    }
    let path = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal.")?;
    let result = write_workbook(std::path::Path::new(&path), &expected_hash, &entry.data)?;
    worklog::mark_written(c, clock.as_ref(), &id).map_err(|e| e.to_string())?;
    Ok(result)
}
