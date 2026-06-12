//! Provider-credential resolution.
//!
//! Credentials are written by the Next.js side into
//! `sabsms_provider_accounts.credentialsCipher` as `v1.<nonceB64>.<ctB64>`
//! (AES-256-GCM, key = `SABSMS_CREDS_KEY` 64 hex chars, 12-byte nonce,
//! GCM tag appended to the ciphertext, AAD = the account's workspaceId).
//! The engine only ever decrypts.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine as _;
use mongodb::bson::{doc, oid::ObjectId, Document};
use tokio::sync::RwLock;

use crate::{db, providers::ProviderCreds, state::AppState, types::ProviderId};

const CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, thiserror::Error)]
pub enum CredsError {
    #[error("no provider credentials configured for workspace")]
    NoCredentials,
    #[error("provider account not found, mismatched, or not active")]
    AccountNotFound,
    #[error("SABSMS_CREDS_KEY missing or invalid (need exactly 64 hex chars)")]
    BadKey,
    #[error("malformed credentials cipher: {0}")]
    BadCipher(String),
    #[error("credential decryption failed")]
    DecryptFailed,
    #[error("decrypted credential blob is not valid JSON: {0}")]
    BadBlob(String),
    #[error("mongo: {0}")]
    Mongo(#[from] mongodb::error::Error),
}

#[derive(Debug)]
pub struct ResolvedCreds {
    /// `None` when creds came from the env fallback.
    pub account_id: Option<String>,
    pub provider: ProviderId,
    pub creds: ProviderCreds,
    /// Per-account webhook secret (plain on the account doc, generated
    /// Next-side) — used to mint `?secret=` DLR callback URLs.
    pub webhook_secret: Option<String>,
}

/// 60s-TTL credential cache, keyed `"{workspace}:{provider}:{account|default}"`.
pub type CredsCache = RwLock<HashMap<String, (Instant, Arc<ResolvedCreds>)>>;

/// Load `SABSMS_CREDS_KEY` (64 hex chars → 32 bytes). Fails closed when a
/// cipher needs decrypting and no valid key is present.
fn load_key() -> Result<[u8; 32], CredsError> {
    let raw = std::env::var("SABSMS_CREDS_KEY").map_err(|_| CredsError::BadKey)?;
    if raw.len() != 64 {
        return Err(CredsError::BadKey);
    }
    let bytes = hex::decode(&raw).map_err(|_| CredsError::BadKey)?;
    bytes.try_into().map_err(|_| CredsError::BadKey)
}

/// Decrypt a `v1.<nonceB64>.<ctB64>` cipher string. AAD = workspaceId.
pub fn decrypt_cipher(
    key: &[u8; 32],
    workspace_id: &str,
    cipher: &str,
) -> Result<String, CredsError> {
    let mut parts = cipher.splitn(3, '.');
    let version = parts.next().unwrap_or_default();
    if version != "v1" {
        return Err(CredsError::BadCipher(format!(
            "unsupported version '{version}'"
        )));
    }
    let nonce_b64 = parts
        .next()
        .ok_or_else(|| CredsError::BadCipher("missing nonce".into()))?;
    let ct_b64 = parts
        .next()
        .ok_or_else(|| CredsError::BadCipher("missing ciphertext".into()))?;

    let b64 = base64::engine::general_purpose::STANDARD;
    let nonce = b64
        .decode(nonce_b64)
        .map_err(|e| CredsError::BadCipher(format!("nonce b64: {e}")))?;
    if nonce.len() != 12 {
        return Err(CredsError::BadCipher(format!(
            "nonce must be 12 bytes, got {}",
            nonce.len()
        )));
    }
    let ct = b64
        .decode(ct_b64)
        .map_err(|e| CredsError::BadCipher(format!("ciphertext b64: {e}")))?;

    let aead = Aes256Gcm::new(key.into());
    let plaintext = aead
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ct,
                aad: workspace_id.as_bytes(),
            },
        )
        .map_err(|_| CredsError::DecryptFailed)?;
    String::from_utf8(plaintext).map_err(|e| CredsError::BadBlob(e.to_string()))
}

fn decrypt_account(account: &Document) -> Result<ProviderCreds, CredsError> {
    let workspace_id = account.get_str("workspaceId").unwrap_or_default();
    let cipher = account
        .get_str("credentialsCipher")
        .map_err(|_| CredsError::BadCipher("credentialsCipher missing".into()))?;
    let key = load_key()?;
    let plaintext = decrypt_cipher(&key, workspace_id, cipher)?;
    let blob: serde_json::Value =
        serde_json::from_str(&plaintext).map_err(|e| CredsError::BadBlob(e.to_string()))?;
    Ok(ProviderCreds { blob })
}

/// Resolve provider credentials for a workspace.
///
/// Order: explicit account id → workspace default account → any active
/// account → env fallback (only when `SABSMS_ALLOW_ENV_CREDS=true`).
pub async fn resolve(
    state: &Arc<AppState>,
    workspace_id: &str,
    provider: ProviderId,
    provider_account_id: Option<&str>,
) -> Result<Arc<ResolvedCreds>, CredsError> {
    let cache_key = format!(
        "{}:{}:{}",
        workspace_id,
        provider.as_str(),
        provider_account_id.unwrap_or("default")
    );

    if let Some((at, cached)) = state.creds_cache.read().await.get(&cache_key) {
        if at.elapsed() < CACHE_TTL {
            return Ok(cached.clone());
        }
    }

    let resolved = Arc::new(resolve_uncached(state, workspace_id, provider, provider_account_id).await?);
    state
        .creds_cache
        .write()
        .await
        .insert(cache_key, (Instant::now(), resolved.clone()));
    Ok(resolved)
}

async fn resolve_uncached(
    state: &Arc<AppState>,
    workspace_id: &str,
    provider: ProviderId,
    provider_account_id: Option<&str>,
) -> Result<ResolvedCreds, CredsError> {
    let accounts = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);

    // 1. Explicit account id — must belong to the workspace and be active.
    if let Some(account_id) = provider_account_id {
        let id_filter = match ObjectId::parse_str(account_id) {
            Ok(oid) => doc! { "_id": oid },
            Err(_) => doc! { "_id": account_id },
        };
        let mut filter = id_filter;
        filter.insert("workspaceId", workspace_id);
        filter.insert("status", "active");
        let account = accounts
            .find_one(filter)
            .await?
            .ok_or(CredsError::AccountNotFound)?;
        let creds = decrypt_account(&account)?;
        return Ok(ResolvedCreds {
            account_id: Some(account_id.to_string()),
            provider,
            creds,
            webhook_secret: account
                .get_str("webhookSecret")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        });
    }

    // 2. Workspace default, then any active account for (workspace, provider).
    let default_filter = doc! {
        "workspaceId": workspace_id,
        "provider": provider.as_str(),
        "isDefault": true,
        "status": "active",
    };
    let any_filter = doc! {
        "workspaceId": workspace_id,
        "provider": provider.as_str(),
        "status": "active",
    };
    let account = match accounts.find_one(default_filter).await? {
        Some(a) => Some(a),
        None => accounts.find_one(any_filter).await?,
    };
    if let Some(account) = account {
        let account_id = account
            .get_object_id("_id")
            .map(|oid| oid.to_hex())
            .or_else(|_| account.get_str("_id").map(|s| s.to_string()))
            .ok();
        let creds = decrypt_account(&account)?;
        return Ok(ResolvedCreds {
            account_id,
            provider,
            creds,
            webhook_secret: account
                .get_str("webhookSecret")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        });
    }

    // 3. Env fallback, gated behind SABSMS_ALLOW_ENV_CREDS=true.
    if std::env::var("SABSMS_ALLOW_ENV_CREDS").unwrap_or_default() == "true"
        && provider == ProviderId::Twilio
    {
        let sid = std::env::var("SABSMS_TWILIO_ACCOUNT_SID").unwrap_or_default();
        let token = std::env::var("SABSMS_TWILIO_AUTH_TOKEN").unwrap_or_default();
        if !sid.is_empty() && !token.is_empty() {
            return Ok(ResolvedCreds {
                account_id: None,
                provider,
                creds: ProviderCreds {
                    blob: serde_json::json!({ "accountSid": sid, "authToken": token }),
                },
                webhook_secret: None,
            });
        }
    }

    Err(CredsError::NoCredentials)
}

/// Drop every cached entry for a workspace (called by
/// `POST /v1/internal/creds/invalidate`).
pub async fn invalidate_workspace(state: &Arc<AppState>, workspace_id: &str) {
    let prefix = format!("{workspace_id}:");
    state
        .creds_cache
        .write()
        .await
        .retain(|k, _| !k.starts_with(&prefix));
}

#[cfg(test)]
mod tests {
    use super::*;
    use aes_gcm::aead::{Aead, KeyInit, Payload};
    use aes_gcm::{Aes256Gcm, Nonce};
    // `base64::Engine` is already in scope via `use super::*`.

    fn fixed_key() -> [u8; 32] {
        let hexkey = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
        hex::decode(hexkey).unwrap().try_into().unwrap()
    }

    fn encrypt_fixture(key: &[u8; 32], workspace_id: &str, plaintext: &str) -> String {
        let nonce_bytes = [42u8; 12];
        let aead = Aes256Gcm::new(key.into());
        let ct = aead
            .encrypt(
                Nonce::from_slice(&nonce_bytes),
                Payload {
                    msg: plaintext.as_bytes(),
                    aad: workspace_id.as_bytes(),
                },
            )
            .unwrap();
        let b64 = base64::engine::general_purpose::STANDARD;
        format!("v1.{}.{}", b64.encode(nonce_bytes), b64.encode(ct))
    }

    #[test]
    fn round_trip_decrypts_plaintext() {
        let key = fixed_key();
        let plaintext = r#"{"accountSid":"AC123","authToken":"tok456"}"#;
        let cipher = encrypt_fixture(&key, "ws_test_1", plaintext);
        let out = decrypt_cipher(&key, "ws_test_1", &cipher).unwrap();
        assert_eq!(out, plaintext);
    }

    #[test]
    fn tampered_aad_fails() {
        let key = fixed_key();
        let cipher = encrypt_fixture(&key, "ws_test_1", r#"{"a":1}"#);
        let err = decrypt_cipher(&key, "ws_other", &cipher).unwrap_err();
        assert!(matches!(err, CredsError::DecryptFailed));
    }

    #[test]
    fn wrong_version_rejected() {
        let key = fixed_key();
        let cipher = encrypt_fixture(&key, "ws", "{}").replacen("v1.", "v2.", 1);
        assert!(matches!(
            decrypt_cipher(&key, "ws", &cipher),
            Err(CredsError::BadCipher(_))
        ));
    }

    /// Cipher produced by the REAL Next.js implementation
    /// (`src/lib/sabsms/credentials.ts`) with key = 64×'a' hex,
    /// nonce = b"0123456789ab", workspaceId = "ws-cross-lang". Pins the
    /// cross-language wire contract — if this test breaks, the two
    /// sides have drifted.
    #[test]
    fn decrypts_node_produced_cipher() {
        let key: [u8; 32] = hex::decode("a".repeat(64)).unwrap().try_into().unwrap();
        let cipher = "v1.MDEyMzQ1Njc4OWFi.Kup9t96+CEqp7YMXli0OUbUd3FPTTT2omiCqQeP+5JBfsNzcoiHTGsCFEPTK4b+PVp98AMHUsnzCHyuf";
        let plain = decrypt_cipher(&key, "ws-cross-lang", cipher).unwrap();
        let v: serde_json::Value = serde_json::from_str(&plain).unwrap();
        assert_eq!(v["accountSid"], "ACtest");
        assert_eq!(v["authToken"], "tok123");
    }

    #[test]
    fn short_nonce_rejected() {
        let key = fixed_key();
        let b64 = base64::engine::general_purpose::STANDARD;
        let cipher = format!("v1.{}.{}", b64.encode([1u8; 8]), b64.encode([0u8; 24]));
        assert!(matches!(
            decrypt_cipher(&key, "ws", &cipher),
            Err(CredsError::BadCipher(_))
        ));
    }
}
