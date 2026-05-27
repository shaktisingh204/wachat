//! On-disk shape of a `sabsheet_presence` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceSelection {
    pub row: u32,
    pub col: u32,
    #[serde(rename = "anchorRow")]
    pub anchor_row: u32,
    #[serde(rename = "anchorCol")]
    pub anchor_col: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetPresence {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "sheetId")]
    pub sheet_id: ObjectId,
    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub selection: PresenceSelection,

    /// Hex color (e.g. `#3aa3ff`) — derived client-side from userId.
    pub color: String,

    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: BsonDateTime,
}
