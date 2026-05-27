//! On-disk shape of a `sabnotebook_notes` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabnotebookNote {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Owning section. A note always lives inside a section.
    pub section_id: ObjectId,

    /// Denormalised notebook id (the section's parent) — keeps notebook
    /// listings cheap without a join.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notebook_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// `"text"` | `"checklist"` | `"audio"` | `"sketch"` | `"file"`.
    pub kind: String,

    /// Opaque JSON-encoded block payload. The client owns the schema; the
    /// server only round-trips the string.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocks_json: Option<String>,

    /// Plain-text preview used for search / list rendering.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,

    /// Hex color or token used for the note card chrome.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(default)]
    pub pinned: bool,

    #[serde(default)]
    pub archived: bool,

    /// Soft-delete flag — kept separate from `archived` so the trash flow
    /// (purge, restore) doesn't collide with the user-facing archive shelf.
    #[serde(default)]
    pub trashed: bool,

    /// Optional reminder timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remind_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
