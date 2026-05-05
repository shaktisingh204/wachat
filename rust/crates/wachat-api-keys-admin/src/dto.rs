//! Wire-format DTOs for the admin API-key endpoints.
//!
//! Field naming uses `serde(rename_all = "camelCase")` so the JSON the
//! Next.js callers see matches what `getApiKeysForUser()` returned in the
//! TS world: `createdAt`, `lastUsedAt`, `requestCount`, `revoked`.
//!
//! The TypeScript spec returned `{ success, apiKey?, error? }` envelopes
//! from each action. We keep that envelope shape on the *generate* and
//! *revoke* responses so the existing client-side call sites can switch
//! to the Rust client without touching any branches.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/// Body for `POST /v1/api-keys`. Mirrors the single `name: string` argument
/// the TS `generateApiKey(name)` server action accepted.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateBody {
    pub name: String,
    /// Optional grant list. Empty/absent defaults to `["*"]` so the new
    /// key is immediately usable against any public-API scope (matches
    /// the TS behavior, which never narrowed scopes at creation time).
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    /// Plan tier — uppercase string, one of `FREE | PRO | ENTERPRISE`.
    /// Optional; the store layer defaults to `FREE`.
    #[serde(default)]
    pub tier: Option<String>,
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/// Result of `POST /v1/api-keys`. `apiKey` carries the **plaintext** key
/// — returned exactly once and never logged or persisted in plaintext on
/// the server. Subsequent reads only ever expose metadata.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResult {
    pub success: bool,
    /// Plaintext token; `None` on failure. Format: `sn_<32 url-safe>`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// Hex `_id` of the new row, useful for audit trails.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// One element of the list response. Strictly metadata — `key` (the
/// SHA-256 hash) is never serialized.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeySummary {
    /// Hex `_id`, used as the path parameter for revoke.
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub revoked: bool,
    pub request_count: u64,
    /// ISO-8601 string. Always present.
    pub created_at: String,
    /// ISO-8601 string. `None` until the key is first used.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

/// Result of `GET /v1/api-keys` — top-level array via Axum `Json`.
pub type ListResult = Vec<ApiKeySummary>;

/// Result of `PATCH /v1/api-keys/:key_id/revoke`. Mirrors the TS
/// `revokeApiKey()` envelope so callers branching on `success` keep
/// working.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
