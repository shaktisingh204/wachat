//! On-disk shape of a `sabsheet_comments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabsheetComment {
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

    #[serde(rename = "authorUserId")]
    pub author_user_id: ObjectId,

    pub body: String,

    #[serde(default)]
    pub resolved: bool,

    #[serde(
        default,
        rename = "parentCommentId",
        skip_serializing_if = "Option::is_none"
    )]
    pub parent_comment_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
