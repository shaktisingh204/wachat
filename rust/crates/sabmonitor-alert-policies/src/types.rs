use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlertConditions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub down_count: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slow_ms: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssl_expiring_days: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlertChannel {
    /// `email` | `sms` | `webhook` | `slack` | `sabwa`
    pub kind: String,
    pub config: JsonValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorAlertPolicy {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub check_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag_selector: Option<String>,
    pub conditions: AlertConditions,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub channels: Vec<AlertChannel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_after_min: Option<i32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub escalate_to: Vec<AlertChannel>,
    /// `active` | `paused`
    pub status: String,
    pub created_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
