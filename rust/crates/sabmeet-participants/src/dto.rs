//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::Participant;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub room_id: Option<String>,
    /// `"active"` (no `leftAt`) | `"all"`.
    #[serde(default)]
    pub state: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinInput {
    pub room_id: String,
    pub display_name: String,
    #[serde(default)]
    pub participant_user_id: Option<String>,
    #[serde(default)]
    pub guest_email: Option<String>,
    /// `"host"` | `"cohost"` | `"participant"` | `"viewer"`. Defaults to participant.
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaveInput {
    /// Optional client-supplied timestamp; server falls back to now.
    #[serde(default)]
    pub left_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinResponse {
    pub id: String,
    pub entity: Participant,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Participant>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
