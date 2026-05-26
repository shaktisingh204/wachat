//! On-disk shape of an `sabconnect_custom_apps` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectCustomApp {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFiles file id for the app icon.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_file_id: Option<String>,

    /// External URL to open. Must be http(s).
    pub url: String,

    /// `"iframe"` | `"new_tab"`.
    #[serde(default)]
    pub open_in: String,

    /// Manual ordering for pinned grid.
    #[serde(default)]
    pub sort_order: i64,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
