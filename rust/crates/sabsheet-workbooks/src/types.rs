//! On-disk shape of a `sabsheet_workbooks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetWorkbook {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// The owner of the workbook (tenant-scoped).
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub title: String,

    /// User IDs the workbook is shared with (besides the owner). For
    /// read/write reads we currently use a union semantic; finer-grained
    /// roles can be layered later.
    #[serde(default, rename = "sharedWithUserIds")]
    pub shared_with_user_ids: Vec<ObjectId>,

    /// `"active"` | `"archived"`.
    pub status: String,

    /// Default sheet to open when the workbook is loaded. Optional because a
    /// newly-created workbook may not have its first sheet provisioned yet
    /// in the same transaction.
    #[serde(default, rename = "defaultSheetId", skip_serializing_if = "Option::is_none")]
    pub default_sheet_id: Option<ObjectId>,

    /// Monotonic version for optimistic concurrency. Bumped on every
    /// workbook-level mutation (sheet add/remove, restore, etc.).
    #[serde(default)]
    pub version: u32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
