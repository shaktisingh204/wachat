//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{ActionItem, AgendaItem, CrmOneOnOne};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub manager_id: Option<String>,
    #[serde(default)]
    pub report_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOneOnOneInput {
    pub manager_id: String,
    #[serde(default)]
    pub manager_name: Option<String>,
    pub report_id: String,
    #[serde(default)]
    pub report_name: Option<String>,
    pub scheduled_at: String,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub agenda: Option<Vec<AgendaItem>>,
    #[serde(default)]
    pub discussion_notes: Option<String>,
    #[serde(default)]
    pub action_items: Option<Vec<ActionItem>>,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub engagement_score: Option<i32>,
    #[serde(default)]
    pub next_meeting_at: Option<String>,
    #[serde(default)]
    pub is_private: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOneOnOneInput {
    #[serde(default)]
    pub manager_id: Option<String>,
    #[serde(default)]
    pub manager_name: Option<String>,
    #[serde(default)]
    pub report_id: Option<String>,
    #[serde(default)]
    pub report_name: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub agenda: Option<Vec<AgendaItem>>,
    #[serde(default)]
    pub discussion_notes: Option<String>,
    #[serde(default)]
    pub action_items: Option<Vec<ActionItem>>,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub engagement_score: Option<i32>,
    #[serde(default)]
    pub next_meeting_at: Option<String>,
    #[serde(default)]
    pub is_private: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOneOnOneResponse {
    pub id: String,
    pub entity: CrmOneOnOne,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOneOnOneResponse {
    pub deleted: bool,
}
