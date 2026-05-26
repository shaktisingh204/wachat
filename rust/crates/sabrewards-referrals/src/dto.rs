//! Request DTOs for `/v1/sabrewards/referrals`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub member_id: Option<String>,
    #[serde(default)]
    pub program_id: Option<String>,
    #[serde(default)]
    pub active_only: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReferralInput {
    pub member_id: String,
    pub code: String,
    #[serde(default)]
    pub program_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogConversionInput {
    pub invitee_id: String,
    /// `"signed_up"` | `"first_purchase"` | `"qualified"`.
    pub kind: String,
    #[serde(default)]
    pub awarded_points: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReferralResponse {
    pub id: String,
    pub entity: crate::types::RewardsReferral,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReferralResponse {
    pub deleted: bool,
}
