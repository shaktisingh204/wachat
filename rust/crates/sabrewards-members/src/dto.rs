//! Request DTOs for `/v1/sabrewards/members`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Hex string of a `sabrewards_programs._id` — scope members to a program.
    #[serde(default)]
    pub program_id: Option<String>,
    /// Free-text search against the joined customer's projected fields. The
    /// caller is expected to flatten name into the document via the
    /// projection step; for now we just narrow by program.
    #[serde(default)]
    pub q: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemberInput {
    pub program_id: String,
    pub customer_id: String,
    #[serde(default)]
    pub welcome_bonus: Option<i64>,
    #[serde(default)]
    pub initial_tier: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustPointsInput {
    pub delta: i64,
    #[serde(default)]
    pub new_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemberResponse {
    pub id: String,
    pub entity: crate::types::RewardsMember,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMemberResponse {
    pub deleted: bool,
}
