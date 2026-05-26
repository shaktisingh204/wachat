//! Request / response DTOs for the sabmeet-rooms HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::{RecurringRule, Room};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"upcoming"` (default), `"past"`, `"live"`, `"all"`.
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub host_user_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoomInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub agenda: Option<Vec<String>>,
    #[serde(default)]
    pub host_user_id: Option<String>,
    #[serde(default)]
    pub cohost_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub invitee_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub invitee_emails: Option<Vec<String>>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub scheduled_end: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub recurring_rule: Option<RecurringRule>,
    #[serde(default)]
    pub passcode: Option<String>,
    #[serde(default)]
    pub lobby_enabled: Option<bool>,
    #[serde(default)]
    pub recording_enabled: Option<bool>,
    #[serde(default)]
    pub require_auth: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRoomInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub agenda: Option<Vec<String>>,
    #[serde(default)]
    pub cohost_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub invitee_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub invitee_emails: Option<Vec<String>>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub scheduled_end: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub recurring_rule: Option<RecurringRule>,
    #[serde(default)]
    pub passcode: Option<String>,
    #[serde(default)]
    pub lobby_enabled: Option<bool>,
    #[serde(default)]
    pub recording_enabled: Option<bool>,
    #[serde(default)]
    pub require_auth: Option<bool>,
    #[serde(default)]
    pub sfu_room_id: Option<String>,
    /// Drives lifecycle transitions: `scheduled` → `live` → `ended` (or `canceled`).
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoomResponse {
    pub id: String,
    pub entity: Room,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRoomResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Room>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
