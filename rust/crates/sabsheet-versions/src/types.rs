//! On-disk shape of a `sabsheet_versions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetVersion {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    /// Monotonic per-workbook version number. Source of truth for ordering.
    pub version: u32,

    #[serde(rename = "savedAt")]
    pub saved_at: BsonDateTime,

    #[serde(rename = "savedBy")]
    pub saved_by: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,

    /// SabFiles file id for the dumped workbook JSON.
    #[serde(default, rename = "snapshotFileId", skip_serializing_if = "Option::is_none")]
    pub snapshot_file_id: Option<ObjectId>,
}
