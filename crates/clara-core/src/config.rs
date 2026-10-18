//! Configuração em claro (`config.json`). Só guarda o que a tarefa agendada
//! precisa de ler sem a palavra-passe. Nunca guarda dados de negócio.

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::paths::{write_atomic, DataDir};

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Config {
    /// Pasta onde são gravadas as cópias cifradas.
    pub backup_dir: Option<String>,
    /// A Andreia confirmou que a pasta pertence à conta Google de trabalho.
    #[serde(default)]
    pub backup_dir_confirmed: bool,
}

impl Config {
    pub fn load(dd: &DataDir) -> Result<Self> {
        match std::fs::read_to_string(dd.config()) {
            Ok(s) => Ok(serde_json::from_str(&s)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn save(&self, dd: &DataDir) -> Result<()> {
        write_atomic(&dd.config(), serde_json::to_string_pretty(self)?.as_bytes())?;
        Ok(())
    }
}
