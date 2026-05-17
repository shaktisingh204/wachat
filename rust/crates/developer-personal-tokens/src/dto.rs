//! Wire-format DTOs for the PAT endpoints.
//!
//! Field naming uses `serde(rename_all = "camelCase")` so the JSON the
//! Next.js callers see is camelCase end-to-end. The response envelopes
//! mirror `wachat-api-keys-admin` so the dashboard can reuse the same
//! UI shells.

use serde::{Deserialize, Serialize};

/* ── Requests ───────────────────────────────────────────────────────────── */

/// Body for `POST /v1/personal-access-tokens`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateBody {
    pub name: String,
    /// Optional grant list. Empty/absent defaults to `["*"]`.
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    /// Plan tier — uppercase string, one of `FREE | PRO | ENTERPRISE`.
    #[serde(default)]
    pub tier: Option<String>,
    /// Optional ISO-8601 expiry. Tokens past this point are rejected by
    /// the verifier without touching the network.
    #[serde(default)]
    pub expires_at: Option<String>,
}

/* ── Responses ──────────────────────────────────────────────────────────── */

/// Result of `POST /v1/personal-access-tokens`. `token` carries the
/// **plaintext** — returned exactly once.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResult {
    pub success: bool,
    /// Plaintext token; `None` on failure. Format: `sab_pat_<32 chars>`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    /// Hex `_id` of the new row.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// One element of the list response. `key` (the SHA-256 hash) is never
/// serialised.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatSummary {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub user_id: String,
    pub scopes: Vec<String>,
    pub tier: String,
    pub revoked: bool,
    pub request_count: u64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

pub type ListResult = Vec<PatSummary>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
