use std::path::{Path, PathBuf};

/// Pasta de dados da Clara. Em produção: `%LOCALAPPDATA%\Clara-Dados`
/// (separada da pasta onde o instalador põe o programa, `%LOCALAPPDATA%\Clara`).
#[derive(Clone, Debug)]
pub struct DataDir {
    root: PathBuf,
}

impl DataDir {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// `%LOCALAPPDATA%\Clara-Dados` no Windows; noutros sistemas, apenas para desenvolvimento.
    pub fn default_location() -> Option<Self> {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            return Some(Self::new(PathBuf::from(local).join("Clara-Dados")));
        }
        std::env::var_os("HOME").map(|h| Self::new(PathBuf::from(h).join(".local/share/clara")))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn db(&self) -> PathBuf {
        self.root.join("clara.db")
    }
    pub fn db_journal(&self) -> PathBuf {
        self.root.join("clara.db-journal")
    }
    pub fn keys(&self) -> PathBuf {
        self.root.join("clara.keys")
    }
    pub fn lock(&self) -> PathBuf {
        self.root.join("clara.lock")
    }
    pub fn config(&self) -> PathBuf {
        self.root.join("config.json")
    }
    pub fn backup_status(&self) -> PathBuf {
        self.root.join("backup-status.json")
    }
    pub fn tmp(&self) -> PathBuf {
        self.root.join("tmp")
    }

    pub fn ensure(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.root)?;
        std::fs::create_dir_all(self.tmp())
    }

    pub fn is_initialized(&self) -> bool {
        self.db().exists() && self.keys().exists()
    }

    /// Apaga temporários que tenham ficado de uma sessão anterior.
    pub fn clean_tmp(&self) {
        if let Ok(rd) = std::fs::read_dir(self.tmp()) {
            for e in rd.flatten() {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}

/// Escrita atómica: ficheiro temporário, sincronização e mudança de nome.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension(format!(
        "{}.partial",
        path.extension().and_then(|e| e.to_str()).unwrap_or("tmp")
    ));
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)
}
