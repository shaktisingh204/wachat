//! Request DTOs — what callers send IN.

use serde::{Deserialize, Serialize};

use crate::types::{EncryptionAlg, SabvaultSecret, SecretKind};

/// `GET /v1/sabvault/secrets?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Searched across `name`, `url`, `tags`.
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by folder.
    #[serde(default)]
    pub folder_id: Option<String>,
    /// Filter by kind.
    #[serde(default)]
    pub kind: Option<SecretKind>,
}

/// `POST /v1/sabvault/secrets` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSecretInput {
    pub name: String,
    pub kind: SecretKind,
    /// Opaque base64 ciphertext envelope. NEVER plaintext.
    pub encrypted_payload_b64: String,
    #[serde(default)]
    pub encryption_alg: EncryptionAlg,
    #[serde(default)]
    pub key_salt_b64: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// `PATCH /v1/sabvault/secrets/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSecretInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<SecretKind>,
    #[serde(default)]
    pub encrypted_payload_b64: Option<String>,
    #[serde(default)]
    pub encryption_alg: Option<EncryptionAlg>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub strength: Option<String>,
    #[serde(default)]
    pub reused: Option<bool>,
    #[serde(default)]
    pub breached: Option<bool>,
    /// If `true`, server stamps `lastRotatedAt = now()`.
    #[serde(default)]
    pub mark_rotated: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/sabvault/secrets` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSecretResponse {
    pub id: String,
    pub entity: SabvaultSecret,
}

/// `DELETE /v1/sabvault/secrets/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSecretResponse {
    pub deleted: bool,
}

/// `GET /v1/sabvault/secrets` response envelope.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabvaultSecret>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
