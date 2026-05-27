//! On-disk shape of a `sabsheet_named_ranges` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetNamedRange {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    /// Display name. Must be unique within the workbook (enforced
    /// app-side).
    pub name: String,

    #[serde(rename = "sheetId")]
    pub sheet_id: ObjectId,

    #[serde(rename = "startRow")]
    pub start_row: u32,
    #[serde(rename = "startCol")]
    pub start_col: u32,
    #[serde(rename = "endRow")]
    pub end_row: u32,
    #[serde(rename = "endCol")]
    pub end_col: u32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
