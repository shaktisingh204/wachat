//! On-disk shape of a `crm_email_templates` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmEmailTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub subject: String,
    /// Primary body (HTML or rich content); aliased to `body` in legacy docs.
    pub body: String,
    /// Optional plain-text fallback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_body: Option<String>,

    /// Free-form bucket: `"transactional"` | `"marketing"` | `"system"` | etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// Placeholder tokens referenced in subject/body (e.g. `["firstName", "orderId"]`).
    #[serde(default)]
    pub variables: Vec<String>,

    /// Active flag, mirrored into `status` for filtering.
    #[serde(default = "default_is_active")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_is_active() -> bool {
    true
}
