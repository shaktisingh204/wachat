//! On-disk shape of a `crm_tasks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecurring {
    pub frequency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTask {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"Follow-up"` | `"Call"` | `"Meeting"` | `"Other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    /// `"Low"` | `"Medium"` | `"High"` | `"Urgent"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,

    /// `"To-Do"` | `"In Progress"` | `"Completed"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reminders: Vec<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<TaskRecurring>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub checklist: Vec<ChecklistItem>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,

    /// `"none"` | `"contact"` | `"deal"` | `"lead"` | `"account"` | `"ticket"` | `"invoice"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
