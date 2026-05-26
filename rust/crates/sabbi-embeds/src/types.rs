//! On-disk shape of a `bi_embeds` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiEmbed {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    /// Random opaque token used in the public URL.
    pub token: String,

    #[serde(default, rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,

    #[serde(default, rename = "allowOrigins")]
    pub allow_origins: Vec<String>,

    /// `"active"` | `"revoked"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
