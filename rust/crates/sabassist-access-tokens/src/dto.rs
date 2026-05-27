//! Request / response DTOs for `sabassist-access-tokens`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub used: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenInput {
    pub session_id: String,
    /// TTL in seconds. Defaults to 900 (15 min).
    #[serde(default)]
    pub ttl_secs: Option<u32>,
    /// If true, generate a 6-digit PIN.
    #[serde(default)]
    pub require_pin: Option<bool>,
    #[serde(default)]
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenResponse {
    pub id: String,
    pub token: String,
    pub session_id: String,
    pub expires_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub one_time_pin: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemTokenInput {
    pub token: String,
    /// Required for attended sessions.
    #[serde(default)]
    pub pin: Option<String>,
    #[serde(default)]
    pub device_fingerprint: Option<String>,
}

/// Public response — INTENTIONALLY redacted. Surfaces just enough for the
/// customer landing page (session id, technician display name, mode) so
/// the page knows what to render. Does not echo user-id / token details.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemTokenResponse {
    pub ok: bool,
    pub session_id: String,
    pub mode: String,
    pub user_id: String,
}
