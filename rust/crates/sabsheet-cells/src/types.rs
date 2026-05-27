//! On-disk shape of a `sabsheet_cells` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Tagged cell value — matches the TS shape `number | string | bool | null`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum CellValue {
    Bool(bool),
    Number(f64),
    Text(String),
    Null(()),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CellRef {
    #[serde(rename = "sheetId")]
    pub sheet_id: ObjectId,
    pub row: u32,
    pub col: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetCell {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "sheetId")]
    pub sheet_id: ObjectId,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub row: u32,
    pub col: u32,

    /// Computed / literal value.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<CellValue>,

    /// Original formula source (without the leading `=`), if the cell was
    /// entered as a formula.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub formula: Option<String>,

    /// Free-form cell formatting blob — numFmt, bg, color, bold, italic,
    /// align, borders, etc. Kept as a BSON Document to stay schema-light.
    #[serde(default, rename = "formatJson", skip_serializing_if = "Option::is_none")]
    pub format_json: Option<Document>,

    /// Cells this formula references (for the recompute graph).
    #[serde(default, rename = "dependsOn", skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<CellRef>,

    #[serde(rename = "createdAt", default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<BsonDateTime>,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
