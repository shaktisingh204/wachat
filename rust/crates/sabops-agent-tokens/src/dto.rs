use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub include_used: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenInput {
    /// TTL in seconds. Defaults to 3600 (1 hour). Clamped to [60, 604800].
    #[serde(default)]
    pub ttl_seconds: Option<u32>,
    #[serde(default)]
    pub intended_os: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenResponse {
    pub id: String,
    pub token: String,
    pub expires_at: String,
    pub entity: crate::types::SabopsAgentToken,
}

/// Internal-use redeem payload (called from the Next.js agent route
/// handler, which validates the agent-token bearer header and forwards).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemTokenInput {
    pub token: String,
    pub hostname: String,
    pub os: String,
    #[serde(default)]
    pub os_version: Option<String>,
    #[serde(default)]
    pub agent_version: Option<String>,
    #[serde(default)]
    pub mac_address: Option<String>,
    #[serde(default)]
    pub serial_number: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemTokenResponse {
    pub endpoint_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeTokenResponse {
    pub revoked: bool,
}
