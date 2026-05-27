use serde::{Deserialize, Serialize};

use crate::types::{GranteeType, SabvaultShare, SharePermission};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Filter by secret.
    #[serde(default)]
    pub secret_id: Option<String>,
    /// Filter by grantee (user/team).
    #[serde(default)]
    pub grantee_id: Option<String>,
    /// `"active"` (default) | `"revoked"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShareInput {
    pub secret_id: String,
    pub grantee_type: GranteeType,
    pub grantee_id: String,
    #[serde(default)]
    pub permission: SharePermission,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Re-wrapped ciphertext (opaque).
    #[serde(default)]
    pub rewrapped_payload_b64: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShareInput {
    #[serde(default)]
    pub permission: Option<SharePermission>,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub rewrapped_payload_b64: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShareResponse {
    pub id: String,
    pub entity: SabvaultShare,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeShareResponse {
    pub revoked: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabvaultShare>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
