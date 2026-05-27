//! On-disk shape of a `sabnotebook_attachments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabnotebookAttachment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub note_id: ObjectId,

    /// SabFiles file id. Sourced via `<SabFilePicker>` only — never a URL.
    pub file_id: ObjectId,

    /// `"image"` | `"audio"` | `"video"` | `"file"`.
    pub kind: String,

    /// Display name (cached from SabFiles for quick rendering).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<i64>,

    /// Optional ordering within the note's attachment strip.
    #[serde(default)]
    pub order: i32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
