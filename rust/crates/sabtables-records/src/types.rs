//! On-disk shape of a `sabtables_records` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub table_id: ObjectId,

    /// Free-form `{ fieldId: value }` map. Values may be primitives,
    /// arrays, or sub-documents depending on field-type.
    #[serde(default)]
    pub fields_json: Document,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_by: Option<ObjectId>,

    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,

    /// `"active"` | `"archived"`.
    pub status: String,
}
