//! On-disk shape of a `sabnotebook_notebooks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabnotebookNotebook {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,

    /// Hex color or named token (`"#3b82f6"`, `"emerald"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    /// SabFiles file id used as the cover image. Never a free-text URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_file_id: Option<ObjectId>,

    /// Optional parent notebook id for nesting (notebook → sub-notebook).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default)]
    pub archived: bool,

    /// Cached note count for the landing grid (refreshed lazily).
    #[serde(default)]
    pub note_count: i64,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
