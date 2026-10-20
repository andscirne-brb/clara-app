//! Núcleo da Clara: segurança, persistência, histórico, catálogo e backups.
//! Não depende do Tauri nem da interface e não tem acesso à rede.

pub mod backup;
pub mod catalog;
pub mod cycle;
pub mod collection;
pub mod capture_audit;
pub mod capture_analysis;
pub mod company_profiles;
pub mod weekly;
pub mod worklog;
pub mod workbook_changes;
pub mod ego_import;
pub mod clock;
pub mod config;
pub mod db;
pub mod error;
pub mod history;
pub mod keys;
pub mod migrations;
pub mod paths;
pub mod recovery;
pub mod schedule;
pub mod settings;
pub mod vault;

pub use error::{ClaraError, Result};

/// Fuso de referência para datas mostradas, nomes de ficheiros e a hora do backup.
pub const TZ: chrono_tz::Tz = chrono_tz::Europe::Lisbon;
