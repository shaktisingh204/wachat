//! Session-recording metadata shape.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "siteId")]
    pub site_id: ObjectId,

    /// Client-generated session identifier.
    pub session_id: String,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,
    pub duration_secs: u32,

    /// SabFiles document id of the JSONL/rrweb event blob. `None`
    /// while the session is still active or has not been finalized.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub events_file_id: Option<ObjectId>,

    pub url_path: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
