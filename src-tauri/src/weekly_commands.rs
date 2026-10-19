use crate::{AppState, task};
use clara_core::{
    settings,
    weekly::{self, Report},
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
type Res<T> = Result<T, String>;
#[derive(serde::Serialize)]
pub struct Overview {
    file_name: Option<String>,
    start: String,
    end: String,
    reports: Vec<Report>,
    reminder: task::TaskStatus,
}
#[tauri::command]
pub async fn weekly_overview(state: State<'_, AppState>) -> Res<Overview> {
    let v = state.vault.lock().unwrap();
    let c = v.conn().map_err(|e| e.to_string())?;
    let now = v.clock().now().with_timezone(&clara_core::TZ);
    let (start, end) = weekly::default_period(now.date_naive());
    let path = settings::get(c, weekly::PATH_KEY).map_err(|e| e.to_string())?;
    Ok(Overview {
        file_name: path.and_then(|p| {
            std::path::Path::new(&p)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
        }),
        start: start.to_string(),
        end: end.to_string(),
        reports: weekly::recent(c).map_err(|e| e.to_string())?,
        reminder: task::weekly_status(),
    })
}
#[tauri::command]
pub async fn weekly_pick(app: AppHandle, state: State<'_, AppState>) -> Res<Option<String>> {
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    state.touch();
    let Some(file) = app
        .dialog()
        .file()
        .set_title("Escolhe o levantamento principal sincronizado do Drive")
        .add_filter("Levantamento", &["xlsm", "xlsx"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = file
        .into_path()
        .map_err(|_| "Escolhe um ficheiro local sincronizado do Drive.")?;
    let names = clara_core::ego_import::sheets(&path).map_err(|e| e.to_string())?;
    if ![
        "Levantamento",
        "Pendências da equipa",
        "Registo de alterações",
    ]
    .iter()
    .all(|s| names.iter().any(|n| n == s))
    {
        return Err("Este ficheiro não tem as folhas de colaboração. Escolhe o levantamento principal atualizado.".into());
    }
    let mut v = state.vault.lock().unwrap();
    let clock = v.clock_arc();
    let c = v.conn_mut().map_err(|e| e.to_string())?;
    settings::put(c, clock.as_ref(), weekly::PATH_KEY, &path.to_string_lossy())
        .map_err(|e| e.to_string())?;
    Ok(path.file_name().map(|s| s.to_string_lossy().to_string()))
}
#[tauri::command]
pub async fn weekly_generate(
    state: State<'_, AppState>,
    start: String,
    end: String,
) -> Res<Report> {
    state.touch();
    let (path, clock) = {
        let v = state.vault.lock().unwrap();
        let c = v.conn().map_err(|e| e.to_string())?;
        (
            settings::get(c, weekly::PATH_KEY)
                .map_err(|e| e.to_string())?
                .ok_or("Escolhe primeiro o levantamento principal.")?,
            v.clock_arc(),
        )
    };
    let cl = clock.clone();
    let report = tauri::async_runtime::spawn_blocking(move || {
        weekly::build(std::path::Path::new(&path), &start, &end, cl.as_ref())
    })
    .await
    .map_err(|_| "A leitura foi interrompida.")?
    .map_err(|e| e.to_string())?;
    let mut v = state.vault.lock().unwrap();
    weekly::save(
        v.conn_mut().map_err(|e| e.to_string())?,
        clock.as_ref(),
        &report,
    )
    .map_err(|e| e.to_string())?;
    Ok(report)
}
#[tauri::command]
pub async fn weekly_reminder(state: State<'_, AppState>, enabled: bool) -> Res<task::TaskStatus> {
    {
        let v = state.vault.lock().unwrap();
        v.conn().map_err(|e| e.to_string())?;
    }
    if enabled {
        task::weekly_install(&state.dd())?
    } else {
        task::weekly_remove()?
    }
    Ok(task::weekly_status())
}
