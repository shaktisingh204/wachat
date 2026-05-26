//! On-disk shape of a `sabbugs_bugs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Bug {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repro_steps: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,

    /// `"trivial"` | `"minor"` | `"major"` | `"critical"` | `"blocker"`.
    pub severity: String,
    /// `"low"` | `"medium"` | `"high"` | `"urgent"`.
    pub priority: String,
    /// `"open"` | `"in_progress"` | `"fixed"` | `"verified"` | `"reopened"` | `"closed"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reporter_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,

    #[serde(default)]
    pub affected_versions: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fixed_in_version: Option<ObjectId>,

    /// SabFiles attachment ids (string form — SabFiles owns the canonical id).
    #[serde(default)]
    pub attachment_ids: Vec<String>,

    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub related_bug_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
