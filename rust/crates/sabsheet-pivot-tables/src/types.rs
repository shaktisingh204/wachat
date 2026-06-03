//! On-disk shape of a `sabsheet_pivot_tables` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetPivotTable {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "sheetId")]
    pub sheet_id: ObjectId,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub name: String,

    /// e.g. `"Sheet1!A1:F500"` — free-form so it can later support
    /// multi-range / table-name sources.
    #[serde(rename = "sourceRange")]
    pub source_range: String,

    /// `{ rows: [...], columns: [...], values: [{ field, agg }], filters: [...] }`
    #[serde(
        default,
        rename = "configJson",
        skip_serializing_if = "Option::is_none"
    )]
    pub config_json: Option<Document>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
