//! Camada Tauri da Clara: comandos específicos, bloqueio por inatividade e
//! backup das 22h com a app aberta. Toda a lógica vive em `clara-core`.

mod collection_commands;
mod commands;
mod cycle_commands;
mod task;
mod weekly_commands;
mod work_commands;
pub fn run_weekly_reminder() -> i32 {
    task::show_weekly_reminder()
}

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use clara_core::backup::{self, RestoreResult, StatusFile};
use clara_core::clock::{Clock, SystemClock};
use clara_core::config::Config;
use clara_core::keys::KdfParams;
use clara_core::paths::DataDir;
use clara_core::schedule;
use clara_core::settings::DEFAULT_LOCK_MINUTES;
use clara_core::vault::Vault;
use tauri::{Emitter, Manager};

pub struct AppState {
    pub ego_import: Mutex<cycle_commands::ImportSession>,
    pub vault: Mutex<Vault>,
    pub last_activity: Mutex<Instant>,
    pub lock_minutes: AtomicU32,
    pub picked_file: Mutex<Option<std::path::PathBuf>>,
    pub pending_restore: Mutex<Option<RestoreResult>>,
    pub last_auto_backup_attempt: Mutex<Option<Instant>>,
}

impl AppState {
    pub fn touch(&self) {
        *self.last_activity.lock().unwrap() = Instant::now();
    }
    pub fn dd(&self) -> DataDir {
        self.vault.lock().unwrap().data_dir().clone()
    }
}

/// `%LOCALAPPDATA%\Clara-Dados` na versão final. As compilações de desenvolvimento
/// (`npm run abrir`) usam `%LOCALAPPDATA%\Clara-Dados-dev`, para nunca misturar
/// testes com dados reais.
fn data_dir() -> DataDir {
    let base = DataDir::default_location().expect("pasta de dados local indisponível");
    if cfg!(debug_assertions) {
        let root = base.root().with_file_name("Clara-Dados-dev");
        DataDir::new(root)
    } else {
        base
    }
}

/// Modo `--scheduled-backup`. Códigos de saída: 0 ok ou nada a fazer, 1 falhou.
pub fn run_scheduled_backup() -> i32 {
    let dd = data_dir();
    let cfg = Config::load(&dd).unwrap_or_default();
    let dir = cfg.backup_dir.as_ref().map(std::path::PathBuf::from);
    match backup::scheduled_backup(&dd, &SystemClock, dir.as_deref()) {
        Ok(backup::ScheduledOutcome::Done(false)) | Err(_) => 1,
        Ok(_) => 0,
    }
}

fn background(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(15));
            let state = app.state::<AppState>();

            // 1. Bloqueio por inatividade.
            let idle = state.last_activity.lock().unwrap().elapsed();
            let limit = Duration::from_secs(state.lock_minutes.load(Ordering::Relaxed) as u64 * 60);
            {
                let mut v = state.vault.lock().unwrap();
                if v.is_unlocked() && idle > limit {
                    v.lock();
                    *state.ego_import.lock().unwrap() = cycle_commands::ImportSession::default();
                    let _ = app.emit("clara://bloqueada", ());
                    continue;
                }
            }

            // 2. Backup das 22h com a app desbloqueada.
            let dd = state.dd();
            let Some(dir) = Config::load(&dd).ok().and_then(|c| c.backup_dir) else {
                continue;
            };
            let now = SystemClock.now();
            if !schedule::app_backup_due(now, StatusFile::load(&dd).last_success_at()) {
                continue;
            }
            {
                let mut last = state.last_auto_backup_attempt.lock().unwrap();
                if last
                    .map(|t| t.elapsed() < Duration::from_secs(30 * 60))
                    .unwrap_or(false)
                {
                    continue;
                }
                *last = Some(Instant::now());
            }
            let v = state.vault.lock().unwrap();
            if let Ok(conn) = v.conn() {
                if let Ok(r) =
                    backup::backup_from_app(conn, &dd, v.clock(), std::path::Path::new(&dir))
                {
                    let _ = app.emit("clara://backup", r.ok);
                }
            }
        }
    });
}

pub fn run() {
    let dd = data_dir();
    let vault = Vault::new(dd, Arc::new(SystemClock), KdfParams::PRODUCTION);
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            ego_import: Mutex::new(cycle_commands::ImportSession::default()),
            vault: Mutex::new(vault),
            last_activity: Mutex::new(Instant::now()),
            lock_minutes: AtomicU32::new(DEFAULT_LOCK_MINUTES),
            picked_file: Mutex::new(None),
            pending_restore: Mutex::new(None),
            last_auto_backup_attempt: Mutex::new(None),
        })
        .setup(|app| {
            background(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            weekly_commands::weekly_overview,
            weekly_commands::weekly_pick,
            weekly_commands::weekly_generate,
            weekly_commands::weekly_reminder,
            work_commands::work_overview,
            work_commands::workbook_changes_preview,
            work_commands::workbook_changes_accept,
            work_commands::work_save,
            work_commands::work_draft_save,
            work_commands::work_cancel,
            work_commands::work_preview,
            work_commands::work_export,
            collection_commands::collection_list,
            collection_commands::collection_draft_get,
            collection_commands::collection_draft_save,
            collection_commands::collection_save,
            collection_commands::collection_suggestions,
            collection_commands::collection_capture,
            cycle_commands::inventory,
            cycle_commands::property_create,
            cycle_commands::property_archive,
            cycle_commands::listing_save,
            cycle_commands::audits_list,
            cycle_commands::audit_draft_get,
            cycle_commands::audit_draft_save,
            cycle_commands::audit_record,
            cycle_commands::change_record,
            cycle_commands::qa_record,
            cycle_commands::ego_pick_file,
            cycle_commands::ego_preview,
            cycle_commands::ego_apply,
            cycle_commands::ego_cancel,
            commands::app_status,
            commands::touch,
            commands::create_vault,
            commands::unlock,
            commands::lock,
            commands::reset_password,
            commands::change_password,
            commands::regenerate_recovery,
            commands::set_lock_minutes,
            commands::portals_list,
            commands::portal_set_monitoring,
            commands::history_list,
            commands::history_verify,
            commands::backup_overview,
            commands::backup_pick_dir,
            commands::backup_confirm_dir,
            commands::backup_now,
            commands::backup_pick_file,
            commands::backup_verify,
            commands::backup_restore,
            commands::task_install,
            commands::task_run_now,
            commands::task_remove,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                window.state::<AppState>().vault.lock().unwrap().lock();
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a Clara");
}
