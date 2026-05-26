//! On-disk shape of an `agile_velocity` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgileVelocity {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub project_id: ObjectId,
    pub sprint_id: ObjectId,
    pub sprint_name: String,

    pub planned_points: f64,
    pub completed_points: f64,

    #[serde(rename = "completedAt")]
    pub completed_at: BsonDateTime,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
