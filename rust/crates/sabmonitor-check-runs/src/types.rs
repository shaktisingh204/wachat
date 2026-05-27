use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorCheckRun {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub check_id: ObjectId,
    pub probe_region: String,
    pub ts: BsonDateTime,
    /// `up` | `down` | `warning`
    pub status: String,
    pub response_ms: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub http_status_code: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssl_days_to_expiry: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    /// JSON-stringified per-step trace for transaction checks.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trace_json: Option<String>,
}
