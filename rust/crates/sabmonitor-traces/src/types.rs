use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorTrace {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub trace_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_service: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_operation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default)]
    pub duration_ms: i64,
    #[serde(default)]
    pub span_count: i32,
    #[serde(default)]
    pub errored: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
