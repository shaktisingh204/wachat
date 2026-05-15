//! AES-256-GCM at-rest encryption for Baileys auth-state blobs.
//!
//! The `auth_state` BSON Binary stored on `sabwa_sessions` is the raw
//! Baileys credential material. Leaking that blob means losing the linked
//! WhatsApp number, so we wrap every read/write through [`AuthStateCrypto`]
//! which transparently encrypts/decrypts with a single 256-bit key sourced
//! from the `SABWA_AUTH_ENCRYPTION_KEY` env var.
//!
//! Wire format: `nonce (12 bytes) || ciphertext || tag`. The tag is bundled
//! into the ciphertext by `aes-gcm` so callers only need to peel off the
//! leading 12 bytes.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use zeroize::Zeroize;

/// Length, in bytes, of the AES-256 key.
const KEY_LEN: usize = 32;
/// Length, in bytes, of a GCM nonce.
const NONCE_LEN: usize = 12;

/// At-rest encryption wrapper. Holds the symmetric key in a `[u8; 32]` that
/// is zeroized on drop.
pub struct AuthStateCrypto {
    key: [u8; KEY_LEN],
}

impl std::fmt::Debug for AuthStateCrypto {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never leak key material via Debug.
        f.debug_struct("AuthStateCrypto").finish_non_exhaustive()
    }
}

impl Drop for AuthStateCrypto {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

impl AuthStateCrypto {
    /// Build a crypto handle from a raw 32-byte key.
    pub fn from_bytes(key: [u8; KEY_LEN]) -> Self {
        Self { key }
    }

    /// Parse a key string. Tries 64-char hex first (optionally `0x`-prefixed),
    /// then falls back to standard base64 of 32 bytes. Errors clearly when
    /// neither shape is valid or the resulting key is the wrong length.
    pub fn from_key_string(raw: &str) -> Result<Self> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(anyhow!(
                "SABWA_AUTH_ENCRYPTION_KEY is empty — must be 32 bytes (64 hex chars or base64)"
            ));
        }

        let hex_candidate = trimmed.strip_prefix("0x").unwrap_or(trimmed);
        if hex_candidate.len() == KEY_LEN * 2
            && hex_candidate.chars().all(|c| c.is_ascii_hexdigit())
        {
            let mut key = [0u8; KEY_LEN];
            for i in 0..KEY_LEN {
                let byte_str = &hex_candidate[i * 2..i * 2 + 2];
                key[i] = u8::from_str_radix(byte_str, 16)
                    .context("SABWA_AUTH_ENCRYPTION_KEY hex parse failed")?;
            }
            return Ok(Self::from_bytes(key));
        }

        // Fall back to base64.
        let decoded = B64.decode(trimmed).map_err(|e| {
            anyhow!(
                "SABWA_AUTH_ENCRYPTION_KEY is neither 64 hex chars nor valid base64: {e}"
            )
        })?;
        if decoded.len() != KEY_LEN {
            return Err(anyhow!(
                "SABWA_AUTH_ENCRYPTION_KEY must decode to exactly {KEY_LEN} bytes (got {})",
                decoded.len()
            ));
        }
        let mut key = [0u8; KEY_LEN];
        key.copy_from_slice(&decoded);
        Ok(Self::from_bytes(key))
    }

    /// Encrypt `plaintext`. Output layout: `nonce(12) || ciphertext||tag`.
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| anyhow!("invalid AES-256-GCM key length: {e}"))?;
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| anyhow!("AES-256-GCM encryption failed: {e}"))?;

        let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    /// Decrypt a blob produced by [`Self::encrypt`].
    pub fn decrypt(&self, blob: &[u8]) -> Result<Vec<u8>> {
        if blob.len() < NONCE_LEN {
            return Err(anyhow!(
                "encrypted auth_state blob is too short: {} bytes (need >= {NONCE_LEN})",
                blob.len()
            ));
        }
        let (nonce_bytes, ciphertext) = blob.split_at(NONCE_LEN);
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| anyhow!("invalid AES-256-GCM key length: {e}"))?;
        let nonce = Nonce::from_slice(nonce_bytes);
        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow!("AES-256-GCM decryption failed (corrupt or wrong key): {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed_crypto() -> AuthStateCrypto {
        // Deterministic key for tests — 32 bytes of `0xAB`.
        AuthStateCrypto::from_bytes([0xAB; KEY_LEN])
    }

    #[test]
    fn roundtrip_encrypts_and_decrypts_back_to_plaintext() {
        let crypto = fixed_crypto();
        let plain = b"baileys-creds:{\"noiseKey\":\"...\",\"signedIdentityKey\":\"...\"}";
        let blob = crypto.encrypt(plain).expect("encrypt");
        // Must include nonce + at least the GCM tag (16 bytes) on top of plaintext.
        assert!(blob.len() > plain.len() + NONCE_LEN);
        let back = crypto.decrypt(&blob).expect("decrypt");
        assert_eq!(back, plain);
    }

    #[test]
    fn encrypt_uses_fresh_nonce_each_call() {
        let crypto = fixed_crypto();
        let plain = b"same plaintext";
        let a = crypto.encrypt(plain).unwrap();
        let b = crypto.encrypt(plain).unwrap();
        assert_ne!(a, b, "two encryptions of the same plaintext must differ");
    }

    #[test]
    fn from_key_string_accepts_hex() {
        let hex: String = "ab".repeat(KEY_LEN);
        let c = AuthStateCrypto::from_key_string(&hex).expect("hex key");
        let blob = c.encrypt(b"hi").unwrap();
        assert_eq!(c.decrypt(&blob).unwrap(), b"hi");
    }

    #[test]
    fn from_key_string_accepts_base64() {
        let b64 = B64.encode([0x42u8; KEY_LEN]);
        let c = AuthStateCrypto::from_key_string(&b64).expect("base64 key");
        let blob = c.encrypt(b"hi").unwrap();
        assert_eq!(c.decrypt(&blob).unwrap(), b"hi");
    }

    #[test]
    fn from_key_string_rejects_wrong_length() {
        // 16-byte base64 — too short for AES-256.
        let short = B64.encode([0u8; 16]);
        assert!(AuthStateCrypto::from_key_string(&short).is_err());
        // Empty.
        assert!(AuthStateCrypto::from_key_string("").is_err());
        // Garbage.
        assert!(AuthStateCrypto::from_key_string("not-hex-not-base64-!!!").is_err());
    }

    #[test]
    fn decrypt_rejects_truncated_blob() {
        let crypto = fixed_crypto();
        assert!(crypto.decrypt(&[0u8; 4]).is_err());
    }
}
