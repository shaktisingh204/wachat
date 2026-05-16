//! On-disk shape of a `crm_subtasks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSubtask {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// ObjectId of the parent task. Points to either `crm_tasks._id`
    /// or `crm_project_tasks._id`, disambiguated by `parent_kind`.
    pub parent_id: ObjectId,
    /// `"task"` | `"project_task"`.
    pub parent_kind: String,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,
    /// Display sort key within the parent's subtask list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,

    /// `"todo"` | `"in_progress"` | `"done"` | `"archived"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
