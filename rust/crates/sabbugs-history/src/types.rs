//! On-disk shape of a `sabbugs_history` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BugHistoryEntry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub bug_id: ObjectId,

    #[serde(rename = "ts")]
    pub ts: BsonDateTime,
    pub actor_id: ObjectId,

    /// Logical field that changed (e.g. `"status"`, `"assigneeId"`).
    pub field: String,

    /// Free-form JSON so we can store strings, arrays, ids, etc.
    #[serde(default)]
    pub old_value: Option<JsonValue>,
    #[serde(default)]
    pub new_value: Option<JsonValue>,
}
