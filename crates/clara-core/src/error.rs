use thiserror::Error;

/// Erros com mensagens em PT-PT prontas a mostrar. Nunca incluem segredos
/// nem conteúdo de negócio.
#[derive(Debug, Error)]
pub enum ClaraError {
    #[error("A palavra-passe tem de ter pelo menos {0} caracteres.")]
    WeakPassword(usize),
    #[error("Palavra-passe ou chave de recuperação incorreta.")]
    WrongSecret,
    #[error("A chave de recuperação não está completa ou tem um erro de cópia.")]
    InvalidRecoveryCode,
    #[error("O ficheiro de chaves está danificado.")]
    CorruptKeyFile,
    #[error("Formato não suportado por esta versão da Clara.")]
    UnsupportedFormat,
    #[error("Não foi possível gerar números aleatórios seguros.")]
    Random,
    #[error("Erro criptográfico.")]
    Crypto,
    #[error("A Clara está bloqueada.")]
    Locked,
    #[error("A Clara ainda não foi configurada.")]
    NotInitialized,
    #[error("A Clara já está configurada neste computador.")]
    AlreadyInitialized,
    #[error("A Clara já está aberta noutra janela ou processo.")]
    AlreadyOpen,
    #[error("O ficheiro de backup é inválido ou está danificado: {0}")]
    InvalidBackup(String),
    #[error("A verificação de integridade falhou: {0}")]
    Integrity(String),
    #[error("A pasta de backup não está definida.")]
    NoBackupDir,
    #[error("A pasta de backup não está acessível: {0}")]
    BackupDirUnavailable(String),
    #[error("O histórico não pode ser alterado nem apagado.")]
    HistoryImmutable,
    #[error("Pedido inválido: {0}")]
    Invalid(String),
    #[error("Não encontrado: {0}")]
    NotFound(String),
    #[error("Erro na base de dados: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Erro de ficheiro: {0}")]
    Io(#[from] std::io::Error),
    #[error("Erro de formato: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, ClaraError>;
