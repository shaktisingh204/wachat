//! Wire DTOs for the email API key surface. All bodies and responses
//! use camelCase to match the TS client.

use serde::{Deserialize, Serialize};

/// One row in the list response — never carries the raw key.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKey {
    pub id: String,
    pub name: String,
    /// First 12 chars of the plaintext (`sn_email_xxx`) — safe to render
    /// since the suffix entropy is intact.
    pub prefix: String,
    pub scopes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub keys: Vec<ApiKey>,
}

/// Body for `POST /` — create a new API key.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKeyBody {
    pub name: String,
    #[serde(default)]
    pub scopes: Vec<String>,
}

/// Response from `POST /` — includes the raw key exactly once. The
/// caller is expected to copy it and never round-trip back to the
/// server; subsequent reads return `ApiKey` (no `rawKey`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKeyResponse {
    pub key: ApiKey,
    pub raw_key: String,
}

/// Body for `PATCH /{id}` — rename / re-scope. Both fields optional;
/// at least one must be present.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKeyBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}
