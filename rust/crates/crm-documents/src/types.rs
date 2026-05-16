//! On-disk shape of a `crm_documents` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// `"id_proof"` | `"address_proof"` | `"qualification"` |
    /// `"experience"` | `"contract"` | `"appointment"` |
    /// `"resignation"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// SabFile reference (URL/key).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_size: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_id: Option<ObjectId>,

    /// `"employee"` | `"candidate"` | `"contact"` | `"account"` | `"vendor"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issue_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_number: Option<String>,

    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default)]
    pub is_confidential: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uploaded_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<BsonDateTime>,

    /// `"pending"` | `"verified"` | `"expired"` | `"rejected"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
