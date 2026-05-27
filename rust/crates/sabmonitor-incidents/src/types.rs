use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorIncident {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub check_id: ObjectId,
    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,
    /// `ongoing` | `resolved`
    pub status: String,
    /// `critical` | `major` | `minor`
    pub severity: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub downtime_secs: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_cause_summary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acknowledged_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acknowledged_at: Option<BsonDateTime>,
    pub created_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
