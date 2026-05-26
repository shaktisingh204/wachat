//! On-disk shape of a `sabsprints_stories` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsprintsStory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub project_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sprint_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub epic_id: Option<ObjectId>,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Story points.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub points: Option<f64>,

    /// Column key: `"todo"` | `"in_progress"` | `"review"` | `"done"` | `"archived"`.
    pub status: String,
    /// `"low"` | `"medium"` | `"high"` | `"urgent"`.
    pub priority: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,

    /// Free-form acceptance criteria lines.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub acceptance_criteria: Vec<String>,

    /// Manual ordering rank within the backlog or sprint board.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rank: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
