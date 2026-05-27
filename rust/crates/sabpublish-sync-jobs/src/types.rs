//! On-disk shape of a `sabpublish_sync_jobs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabpublishSyncJob {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "locationId")]
    pub location_id: ObjectId,
    pub provider_id: String,

    /// `"push"` | `"pull"` | `"verify"`.
    pub kind: String,
    /// `"queued"` | `"running"` | `"success"` | `"failed"` | `"partial"`.
    pub status: String,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(default)]
    pub changed_fields_count: u32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
