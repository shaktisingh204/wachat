//! Wire DTOs for the email outbound webhook surface.

use serde::{Deserialize, Serialize};

/// Outbound webhook configuration row.
///
/// `secret` is returned only on `POST /` so the caller can stash it
/// for HMAC verification on their side. Subsequent reads omit it; if the
/// caller loses the secret they need to recreate the config.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookConfig {
    pub id: String,
    pub url: String,
    pub events: Vec<String>,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_delivered_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_failed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Wrapper for the create response — includes `secret` exactly once.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookConfigWithSecret {
    #[serde(flatten)]
    pub config: WebhookConfig,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub configs: Vec<WebhookConfig>,
}

/// Body for `POST /` — `regenerateSecret` is ignored on create (a secret
/// is always minted) and only honoured on `PATCH /{id}`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub url: String,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default = "default_active")]
    pub active: bool,
}

fn default_active() -> bool {
    true
}

/// Body for `PATCH /{id}` — every field optional.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBody {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub active: Option<bool>,
    /// When `true`, mint a fresh secret. The response is the
    /// secret-bearing flavour so the caller can copy it.
    #[serde(default)]
    pub regenerate_secret: bool,
}

/// Response from `PATCH /{id}` when `regenerateSecret == true`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResponse {
    pub config: WebhookConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResponse {
    pub delivered: bool,
    pub status: Option<u16>,
}
