//! Código de recuperação para imprimir ou escrever em papel.
//!
//! 16 bytes aleatórios + 4 bytes de verificação = 32 caracteres Crockford
//! Base32, em 8 blocos de 4 (ex.: `K7QM-2XPA-...`). Sem letras ambíguas
//! (I, L, O, U), maiúsculas e minúsculas indiferentes, e os erros de cópia
//! são detetados antes de tentar desbloquear.

use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::error::{ClaraError, Result};

const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SECRET_LEN: usize = 16;
const CHECK_LEN: usize = 4;
pub const GROUPS: usize = 8;

pub struct RecoveryCode {
    secret: Zeroizing<[u8; SECRET_LEN]>,
}

fn checksum(secret: &[u8]) -> [u8; CHECK_LEN] {
    let mut h = Sha256::new();
    h.update(b"clara/recovery/v1");
    h.update(secret);
    let d = h.finalize();
    [d[0], d[1], d[2], d[3]]
}

fn encode(bytes: &[u8; 20]) -> String {
    // 160 bits -> 32 símbolos de 5 bits.
    let mut out = String::with_capacity(32);
    let mut acc: u32 = 0;
    let mut bits = 0;
    for &b in bytes {
        acc = (acc << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((acc >> bits) & 31) as usize] as char);
        }
    }
    out
}

fn decode_char(c: char) -> Option<u32> {
    let c = c.to_ascii_uppercase();
    let c = match c {
        'O' => '0',
        'I' | 'L' => '1',
        other => other,
    };
    ALPHABET.iter().position(|&a| a as char == c).map(|p| p as u32)
}

impl RecoveryCode {
    pub fn generate() -> Result<Self> {
        let mut s = Zeroizing::new([0u8; SECRET_LEN]);
        getrandom::fill(s.as_mut()).map_err(|_| ClaraError::Random)?;
        Ok(Self { secret: s })
    }

    pub fn secret_bytes(&self) -> &[u8] {
        self.secret.as_ref()
    }

    /// Texto para mostrar e escrever: 8 blocos de 4 caracteres.
    pub fn display(&self) -> String {
        let mut all = [0u8; 20];
        all[..SECRET_LEN].copy_from_slice(self.secret.as_ref());
        all[SECRET_LEN..].copy_from_slice(&checksum(self.secret.as_ref()));
        let raw = encode(&all);
        raw.as_bytes()
            .chunks(4)
            .map(|c| std::str::from_utf8(c).unwrap())
            .collect::<Vec<_>>()
            .join("-")
    }

    pub fn groups(&self) -> Vec<String> {
        self.display().split('-').map(str::to_string).collect()
    }

    /// Aceita espaços, hífenes e minúsculas. Erra se faltar ou sobrar algo,
    /// ou se a verificação falhar (provável erro de cópia).
    pub fn parse(input: &str) -> Result<Self> {
        let symbols: Vec<u32> = input
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .map(|c| decode_char(c).ok_or(ClaraError::InvalidRecoveryCode))
            .collect::<Result<_>>()?;
        if symbols.len() != 32 {
            return Err(ClaraError::InvalidRecoveryCode);
        }
        let mut bytes = Zeroizing::new([0u8; 20]);
        let mut acc: u64 = 0;
        let mut bits = 0;
        let mut i = 0;
        for s in symbols {
            acc = (acc << 5) | s as u64;
            bits += 5;
            if bits >= 8 {
                bits -= 8;
                bytes[i] = ((acc >> bits) & 0xff) as u8;
                i += 1;
            }
        }
        let mut secret = Zeroizing::new([0u8; SECRET_LEN]);
        secret.copy_from_slice(&bytes[..SECRET_LEN]);
        if checksum(secret.as_ref()) != bytes[SECRET_LEN..] {
            return Err(ClaraError::InvalidRecoveryCode);
        }
        Ok(Self { secret })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_with_lenient_input() {
        let c = RecoveryCode::generate().unwrap();
        let shown = c.display();
        assert_eq!(shown.len(), 32 + 7);
        assert_eq!(c.groups().len(), GROUPS);
        let messy = shown.to_lowercase().replace('-', " ");
        assert_eq!(RecoveryCode::parse(&messy).unwrap().secret_bytes(), c.secret_bytes());
    }

    #[test]
    fn typo_is_detected() {
        let c = RecoveryCode::generate().unwrap();
        let mut s: Vec<char> = c.display().chars().collect();
        s[0] = if s[0] == 'A' { 'B' } else { 'A' };
        let typo: String = s.into_iter().collect();
        assert!(RecoveryCode::parse(&typo).is_err());
    }

    #[test]
    fn wrong_length_rejected() {
        assert!(RecoveryCode::parse("ABCD-EFGH").is_err());
    }
}
