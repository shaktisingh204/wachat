//! On-disk shape of a `crm_project_tasks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProjectTask {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,

    /// `"low"` | `"medium"` | `"high"`.
    pub priority: String,
    /// `"todo"` | `"in_progress"` | `"done"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress: Option<i32>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
