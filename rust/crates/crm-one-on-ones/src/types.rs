//! On-disk shape of a `crm_one_on_ones` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgendaItem {
    pub id: String,
    pub topic: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_minutes: Option<i32>,
    #[serde(default)]
    pub discussed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionItem {
    pub id: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,
    /// `"open"` | `"in_progress"` | `"done"` | `"cancelled"`.
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmOneOnOne {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub manager_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_name: Option<String>,
    pub report_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_name: Option<String>,

    pub scheduled_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_minutes: Option<i32>,
    /// Physical address or meeting URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    #[serde(default)]
    pub agenda: Vec<AgendaItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discussion_notes: Option<String>,
    #[serde(default)]
    pub action_items: Vec<ActionItem>,

    /// `"happy"` | `"neutral"` | `"concerned"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
    /// 1..=5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engagement_score: Option<i32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_meeting_at: Option<BsonDateTime>,

    /// Visible only to participants when true.
    #[serde(default = "default_true")]
    pub is_private: bool,

    /// `"scheduled"` | `"in_progress"` | `"completed"` | `"cancelled"` | `"no_show"` | `"archived"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
