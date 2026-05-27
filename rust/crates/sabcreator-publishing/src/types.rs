//! On-disk shape of a `sabcreator_publications` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorPublication {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    /// Monotonically increasing per-app version (1, 2, 3 …).
    pub version: u32,

    pub published_at: BsonDateTime,
    pub published_by: ObjectId,

    /// Full frozen blob: `{ app, forms, pages, workflows, roles }`.
    pub snapshot_json: Value,
}
