//! On-disk shape of a `sabcreator_apps` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorApp {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub slug: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFiles file id (the picker returns a SabFile pick — store its id).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_file_id: Option<String>,

    /// Optional link to a SabTables base. Forms in this app create tables
    /// under this base.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sabtables_base_id: Option<ObjectId>,

    /// `draft` | `published` | `archived`.
    pub status: String,

    /// Free-form theme blob — `{ "primary": "#7c3aed", "logoFileId": "…" }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<Value>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
