//! On-disk shape of a `sabsprints_sprints` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsprintsSprint {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub project_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub goal: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    /// Capacity in story points (planning bound).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity_points: Option<f64>,

    /// `"planned"` | `"active"` | `"completed"` | `"cancelled"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
