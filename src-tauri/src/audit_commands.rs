use crate::AppState;
use clara_core::{
    capture_audit::{self, Audit, Prepared},
    settings, weekly,
};
use tauri::State;
type Res<T> = Result<T, String>;
#[tauri::command]
pub async fn capture_audit_draft_get(
    state: State<'_, AppState>,
    reference: String,
) -> Res<Option<Audit>> {
    let v = state.vault.lock().unwrap();
    capture_audit::draft(v.conn().map_err(|e| e.to_string())?, &reference)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn capture_audit_draft_save(state: State<'_, AppState>, data: Audit) -> Res<()> {
    state.touch();
    let v = state.vault.lock().unwrap();
    capture_audit::save(v.conn().map_err(|e| e.to_string())?, v.clock(), &data)
        .map_err(|e| e.to_string())
}
#[derive(serde::Serialize)]
pub struct CaptureResult {
    name: String,
    text: String,
    description: Option<String>,
}
#[tauri::command]
pub async fn capture_audit_image(
    state: State<'_, AppState>,
    name: String,
    bytes: Vec<u8>,
) -> Res<CaptureResult> {
    state.touch();
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    if bytes.len() > 10000000 || bytes.len() < 8 || name.len() > 300 {
        return Err("Usa PNG/JPEG até 10 MB por captura. Divide imagens maiores.".into());
    }
    let ext = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "png"
    } else if bytes.starts_with(&[255, 216, 255]) {
        "jpg"
    } else {
        return Err("Formato não suportado. Usa uma imagem PNG ou JPEG.".into());
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let path =
            std::env::temp_dir().join(format!("Clara-captura-{}.{}", capture_audit::new_id(), ext));
        let mut created = false;
        let result = (|| {
            let mut f = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|_| "Não foi possível preparar a leitura local.")?;
            created = true;
            f.write_all(&bytes)
                .map_err(|_| "Não foi possível preparar a imagem.")?;
            drop(f);
            crate::collection_commands::read_ocr(&path)
        })();
        if created { let _ = std::fs::remove_file(&path); }
        result
    })
    .await
    .map_err(|_| "Leitura interrompida.")??;
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    let description = capture_audit::extract(&result);
    Ok(CaptureResult {
        name,
        text: result,
        description,
    })
}
#[tauri::command]
pub async fn capture_audit_prepare(state: State<'_, AppState>, data: Audit) -> Res<Prepared> {
    state.touch();
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    let path = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal em Resumo semanal.")?;
    capture_audit::prepare(c, v.clock(), std::path::Path::new(&path), &data)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn capture_audit_write(
    state: State<'_, AppState>,
    id: String,
) -> Res<crate::work_commands::Written> {
    state.touch();
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let c = v.conn_mut().map_err(|e| e.to_string())?;
    let mut p = capture_audit::prepared(c, &id).map_err(|e| e.to_string())?;
    let path = settings::get(c, weekly::PATH_KEY)
        .map_err(|e| e.to_string())?
        .ok_or("Escolhe o levantamento principal.")?;
    if path != p.path {
        return Err("O ficheiro principal mudou. Pré-visualiza novamente.".into());
    }
    let work = clara_core::worklog::Work {
        id: p.id.clone(),
        date: p.date.clone(),
        reference: p.reference.clone(),
        author: "Andreia".into(),
        location: "Levantamento Excel".into(),
        field: "Levantamento por capturas".into(),
        before: "Valores anteriores preservados no histórico da Clara".into(),
        after: format!(
            "Revistos {} campos a partir de capturas. Registo de levantamento; não confirma correções no eGO.",
            p.cells.len()
        ),
        reason: p.source.clone(),
        verification: "Confirmado pela autora".into(),
    };
    let result = crate::work_commands::write_request(
        serde_json::json!({"path":path,"expected_hash":p.hash,"work":work,"audit":p}),
    )?;
    capture_audit::mark_written(c, clock.as_ref(), &mut p).map_err(|e| e.to_string())?;
    Ok(result)
}
