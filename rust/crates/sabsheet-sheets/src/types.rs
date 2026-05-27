//! On-disk shape of a `sabsheet_sheets` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetSheet {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    /// Owner mirrored from workbook for cheap tenant filtering.
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub name: String,

    /// Tab order within the workbook (0-based).
    #[serde(default)]
    pub position: u32,

    #[serde(default = "default_row_count", rename = "rowCount")]
    pub row_count: u32,

    #[serde(default = "default_col_count", rename = "colCount")]
    pub col_count: u32,

    #[serde(default, rename = "frozenRows")]
    pub frozen_rows: u32,

    #[serde(default, rename = "frozenCols")]
    pub frozen_cols: u32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_row_count() -> u32 {
    1000
}
fn default_col_count() -> u32 {
    26
}
