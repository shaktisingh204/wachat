use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorStatusPage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub slug: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<JsonValue>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub check_ids: Vec<ObjectId>,
    #[serde(default)]
    pub show_historical_uptime: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_header: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
    /// `live` | `paused`
    pub status: String,
    pub created_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
