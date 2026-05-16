//! On-disk shape of a `crm_policies` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPolicy {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    /// Free-form version label, e.g. `"1.0"`, `"2025.03"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    /// `"leave"` | `"travel"` | `"code_of_conduct"` | `"it_security"` |
    /// `"hr"` | `"finance"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// SabFile reference (URL or id) for an attached PDF/doc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_url: Option<String>,
    /// Inline markdown body, used when there is no attached document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(default)]
    pub department_ids: Vec<ObjectId>,

    #[serde(default)]
    pub acknowledgement_required: bool,
    #[serde(default)]
    pub acknowledgement_count: i64,

    /// `"draft"` | `"published"` | `"under_review"` | `"archived"` |
    /// `"obsolete"`.
    pub status: String,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
