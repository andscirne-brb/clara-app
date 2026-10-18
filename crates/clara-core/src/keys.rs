//! Chaves da Clara.
//!
//! A base de dados é cifrada com uma chave mestra aleatória de 256 bits.
//! Essa chave nunca é guardada em claro: fica "embrulhada" duas vezes,
//! uma pela palavra-passe e outra pela chave de recuperação em papel,
//! ambas derivadas com Argon2id e cifradas com XChaCha20-Poly1305.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};

use crate::error::{ClaraError, Result};
use crate::recovery::RecoveryCode;

pub const MIN_PASSWORD_CHARS: usize = 12;
const KEYFILE_FORMAT: u32 = 1;
const AAD_PASSWORD: &[u8] = b"clara/keyfile/v1/password";
const AAD_RECOVERY: &[u8] = b"clara/keyfile/v1/recovery";

/// Chave mestra em memória. Apagada da memória quando sai de âmbito.
pub struct MasterKey(Zeroizing<[u8; 32]>);

impl MasterKey {
    pub fn generate() -> Result<Self> {
        let mut k = Zeroizing::new([0u8; 32]);
        getrandom::fill(k.as_mut()).map_err(|_| ClaraError::Random)?;
        Ok(Self(k))
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Formato aceite pelo SQLCipher para chaves em bruto: x'<64 hex>'.
    pub fn sqlcipher_pragma_value(&self) -> Zeroizing<String> {
        Zeroizing::new(format!("x'{}'", hex::encode(self.0.as_ref())))
    }
}

/// Parâmetros do Argon2id, guardados no ficheiro para poderem evoluir.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

impl KdfParams {
    /// Valores de produção: cerca de 64 MiB e 3 passagens.
    pub const PRODUCTION: KdfParams = KdfParams { memory_kib: 64 * 1024, iterations: 3, parallelism: 1 };
    /// Valores rápidos, apenas para testes automáticos.
    pub const TESTING: KdfParams = KdfParams { memory_kib: 256, iterations: 1, parallelism: 1 };
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WrappedKey {
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

/// Conteúdo de `clara.keys`. Pode ser copiado sem risco: sem a palavra-passe
/// ou a chave de recuperação não revela a chave mestra.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KeyFile {
    pub format: u32,
    pub kdf: KdfParams,
    pub password: WrappedKey,
    pub recovery: WrappedKey,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SecretKind {
    Password,
    Recovery,
}

pub fn validate_password(password: &str) -> Result<()> {
    if password.chars().count() < MIN_PASSWORD_CHARS {
        return Err(ClaraError::WeakPassword(MIN_PASSWORD_CHARS));
    }
    Ok(())
}

fn random<const N: usize>() -> Result<[u8; N]> {
    let mut b = [0u8; N];
    getrandom::fill(&mut b).map_err(|_| ClaraError::Random)?;
    Ok(b)
}

fn derive(secret: &[u8], salt: &[u8], kdf: KdfParams) -> Result<Zeroizing<[u8; 32]>> {
    let params = Params::new(kdf.memory_kib, kdf.iterations, kdf.parallelism, Some(32))
        .map_err(|_| ClaraError::Crypto)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = Zeroizing::new([0u8; 32]);
    argon.hash_password_into(secret, salt, out.as_mut()).map_err(|_| ClaraError::Crypto)?;
    Ok(out)
}

fn wrap(master: &MasterKey, secret: &[u8], kdf: KdfParams, aad: &[u8]) -> Result<WrappedKey> {
    let salt: [u8; 16] = random()?;
    let nonce: [u8; 24] = random()?;
    let kek = derive(secret, &salt, kdf)?;
    let cipher = XChaCha20Poly1305::new((&*kek).into());
    let ct = cipher
        .encrypt(&XNonce::from(nonce), Payload { msg: master.as_bytes(), aad })
        .map_err(|_| ClaraError::Crypto)?;
    Ok(WrappedKey { salt: hex::encode(salt), nonce: hex::encode(nonce), ciphertext: hex::encode(ct) })
}

fn unwrap(w: &WrappedKey, secret: &[u8], kdf: KdfParams, aad: &[u8]) -> Result<MasterKey> {
    let salt = hex::decode(&w.salt).map_err(|_| ClaraError::CorruptKeyFile)?;
    let nonce: [u8; 24] = hex::decode(&w.nonce)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or(ClaraError::CorruptKeyFile)?;
    let ct = hex::decode(&w.ciphertext).map_err(|_| ClaraError::CorruptKeyFile)?;
    let kek = derive(secret, &salt, kdf)?;
    let cipher = XChaCha20Poly1305::new((&*kek).into());
    let mut pt = cipher
        .decrypt(&XNonce::from(nonce), Payload { msg: &ct, aad })
        .map_err(|_| ClaraError::WrongSecret)?;
    if pt.len() != 32 {
        pt.zeroize();
        return Err(ClaraError::CorruptKeyFile);
    }
    let mut k = Zeroizing::new([0u8; 32]);
    k.copy_from_slice(&pt);
    pt.zeroize();
    Ok(MasterKey(k))
}

impl KeyFile {
    /// Cria chave mestra, palavra-passe e código de recuperação novos.
    pub fn create(password: &str, kdf: KdfParams) -> Result<(KeyFile, MasterKey, RecoveryCode)> {
        validate_password(password)?;
        let master = MasterKey::generate()?;
        let code = RecoveryCode::generate()?;
        let kf = KeyFile {
            format: KEYFILE_FORMAT,
            kdf,
            password: wrap(&master, password.as_bytes(), kdf, AAD_PASSWORD)?,
            recovery: wrap(&master, code.secret_bytes(), kdf, AAD_RECOVERY)?,
        };
        Ok((kf, master, code))
    }

    pub fn unlock(&self, kind: SecretKind, secret: &str) -> Result<MasterKey> {
        if self.format != KEYFILE_FORMAT {
            return Err(ClaraError::UnsupportedFormat);
        }
        match kind {
            SecretKind::Password => unwrap(&self.password, secret.as_bytes(), self.kdf, AAD_PASSWORD),
            SecretKind::Recovery => {
                let code = RecoveryCode::parse(secret)?;
                unwrap(&self.recovery, code.secret_bytes(), self.kdf, AAD_RECOVERY)
            }
        }
    }

    /// Troca a palavra-passe. A chave mestra e a base não mudam.
    pub fn change_password(&mut self, current: &str, new_password: &str) -> Result<()> {
        validate_password(new_password)?;
        let master = self.unlock(SecretKind::Password, current)?;
        self.password = wrap(&master, new_password.as_bytes(), self.kdf, AAD_PASSWORD)?;
        Ok(())
    }

    /// Gera um código de recuperação novo; o antigo deixa de funcionar.
    pub fn regenerate_recovery(&mut self, password: &str) -> Result<RecoveryCode> {
        let master = self.unlock(SecretKind::Password, password)?;
        let code = RecoveryCode::generate()?;
        self.recovery = wrap(&master, code.secret_bytes(), self.kdf, AAD_RECOVERY)?;
        Ok(code)
    }

    /// Repõe a palavra-passe com o código de recuperação (palavra-passe esquecida).
    pub fn reset_password_with_recovery(&mut self, code: &str, new_password: &str) -> Result<()> {
        validate_password(new_password)?;
        let master = self.unlock(SecretKind::Recovery, code)?;
        self.password = wrap(&master, new_password.as_bytes(), self.kdf, AAD_PASSWORD)?;
        Ok(())
    }

    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    pub fn from_json(s: &str) -> Result<Self> {
        serde_json::from_str(s).map_err(|_| ClaraError::CorruptKeyFile)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PW: &str = "uma frase bem longa";

    #[test]
    fn password_and_recovery_unlock_same_key() {
        let (kf, master, code) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        let a = kf.unlock(SecretKind::Password, PW).unwrap();
        let b = kf.unlock(SecretKind::Recovery, &code.display()).unwrap();
        assert_eq!(a.as_bytes(), master.as_bytes());
        assert_eq!(b.as_bytes(), master.as_bytes());
    }

    #[test]
    fn wrong_password_fails() {
        let (kf, _, _) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        assert!(matches!(kf.unlock(SecretKind::Password, "outra frase longa"), Err(ClaraError::WrongSecret)));
    }

    #[test]
    fn short_password_rejected() {
        assert!(matches!(KeyFile::create("curta", KdfParams::TESTING), Err(ClaraError::WeakPassword(_))));
    }

    #[test]
    fn change_password_keeps_master_key() {
        let (mut kf, master, code) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        kf.change_password(PW, "nova frase ainda maior").unwrap();
        assert!(kf.unlock(SecretKind::Password, PW).is_err());
        let k = kf.unlock(SecretKind::Password, "nova frase ainda maior").unwrap();
        assert_eq!(k.as_bytes(), master.as_bytes());
        assert!(kf.unlock(SecretKind::Recovery, &code.display()).is_ok());
    }

    #[test]
    fn regenerate_recovery_invalidates_old_code() {
        let (mut kf, master, old) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        let new = kf.regenerate_recovery(PW).unwrap();
        assert!(kf.unlock(SecretKind::Recovery, &old.display()).is_err());
        assert_eq!(kf.unlock(SecretKind::Recovery, &new.display()).unwrap().as_bytes(), master.as_bytes());
    }

    #[test]
    fn reset_password_with_recovery() {
        let (mut kf, master, code) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        kf.reset_password_with_recovery(&code.display(), "esqueci-me da outra").unwrap();
        assert_eq!(kf.unlock(SecretKind::Password, "esqueci-me da outra").unwrap().as_bytes(), master.as_bytes());
    }

    #[test]
    fn keyfile_json_roundtrip_and_tamper() {
        let (kf, _, _) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        let mut back = KeyFile::from_json(&kf.to_json().unwrap()).unwrap();
        assert_eq!(back, kf);
        let mut ct = hex::decode(&back.password.ciphertext).unwrap();
        ct[0] ^= 1;
        back.password.ciphertext = hex::encode(ct);
        assert!(back.unlock(SecretKind::Password, PW).is_err());
    }

    #[test]
    fn keyfile_contains_no_master_key() {
        let (kf, master, _) = KeyFile::create(PW, KdfParams::TESTING).unwrap();
        assert!(!kf.to_json().unwrap().contains(&hex::encode(master.as_bytes())));
    }
}
