//! Mailbox-credential decryption.
//!
//! Credentials are written by the Next.js side into
//! `sabmail_accounts.credentialsCipher` as `v1.<nonceB64>.<ctB64>`
//! (AES-256-GCM, key = `SABMAIL_CREDS_KEY`/`SABSMS_CREDS_KEY` 64 hex chars,
//! 12-byte nonce, GCM tag appended to the ciphertext, AAD = the account's
//! workspaceId). See `src/lib/sabmail/credentials.ts`. The engine only
//! ever decrypts.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine as _;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CredsError {
    #[error("SABMAIL_CREDS_KEY missing or invalid (need exactly 64 hex chars)")]
    BadKey,
    #[error("malformed credentials cipher: {0}")]
    BadCipher(String),
    #[error("credential decryption failed")]
    DecryptFailed,
    #[error("decrypted credential blob is not valid JSON: {0}")]
    BadBlob(String),
}

/// 64 hex chars → 32 bytes.
fn parse_key(key_hex: &str) -> Result<[u8; 32], CredsError> {
    if key_hex.len() != 64 {
        return Err(CredsError::BadKey);
    }
    let bytes = hex::decode(key_hex).map_err(|_| CredsError::BadKey)?;
    bytes.try_into().map_err(|_| CredsError::BadKey)
}

/// Decrypt a `v1.<nonceB64>.<ctB64>` cipher string. AAD = workspaceId.
/// Returns the decrypted plaintext (provider-specific JSON).
pub fn decrypt_cipher(
    key_hex: &str,
    workspace_id: &str,
    cipher: &str,
) -> Result<String, CredsError> {
    let key = parse_key(key_hex)?;

    let mut parts = cipher.splitn(3, '.');
    let version = parts.next().unwrap_or_default();
    if version != "v1" {
        return Err(CredsError::BadCipher(format!("unsupported version '{version}'")));
    }
    let nonce_b64 = parts
        .next()
        .ok_or_else(|| CredsError::BadCipher("missing nonce".into()))?;
    let ct_b64 = parts
        .next()
        .ok_or_else(|| CredsError::BadCipher("missing ciphertext".into()))?;

    let b64 = base64::engine::general_purpose::STANDARD;
    let nonce_bytes = b64
        .decode(nonce_b64)
        .map_err(|e| CredsError::BadCipher(format!("nonce b64: {e}")))?;
    if nonce_bytes.len() != 12 {
        return Err(CredsError::BadCipher("nonce must be 12 bytes".into()));
    }
    let ct = b64
        .decode(ct_b64)
        .map_err(|e| CredsError::BadCipher(format!("ciphertext b64: {e}")))?;

    let cipher_engine =
        Aes256Gcm::new_from_slice(&key).map_err(|_| CredsError::BadKey)?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher_engine
        .decrypt(
            nonce,
            Payload {
                msg: &ct,
                aad: workspace_id.as_bytes(),
            },
        )
        .map_err(|_| CredsError::DecryptFailed)?;

    String::from_utf8(plaintext).map_err(|e| CredsError::BadBlob(e.to_string()))
}

/// Decrypt + parse the mailbox secrets blob into a JSON value.
pub fn decrypt_creds(
    key_hex: &str,
    workspace_id: &str,
    cipher: &str,
) -> Result<serde_json::Value, CredsError> {
    let plaintext = decrypt_cipher(key_hex, workspace_id, cipher)?;
    serde_json::from_str(&plaintext).map_err(|e| CredsError::BadBlob(e.to_string()))
}
