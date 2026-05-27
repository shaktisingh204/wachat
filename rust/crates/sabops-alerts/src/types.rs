use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabopsAlert {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub endpoint_id: ObjectId,

    /// `"stale" | "low_disk" | "low_battery" | "patch_failed" | "unauthorized_software"`.
    pub kind: String,
    /// `"critical" | "high" | "medium" | "low"`.
    pub severity: String,
    pub message: String,
    pub raised_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acknowledged_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acknowledged_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<BsonDateTime>,
}
