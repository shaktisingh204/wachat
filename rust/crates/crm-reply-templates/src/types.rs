//! On-disk shape of a `crm_reply_templates` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmReplyTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human-readable template name.
    pub name: String,
    /// Slash-command-style trigger (e.g. `/greet`, `/refund`). Optional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    /// Reply body. May contain `{{variable}}` placeholders.
    pub body: String,

    /// Free-form bucket: `"support"` | `"sales"` | `"billing"` | etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// ISO-639 language code; defaults to `"en"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,

    /// Placeholder tokens referenced in `body` (e.g. `["firstName", "ticketId"]`).
    #[serde(default)]
    pub variables: Vec<String>,

    /// Active flag, mirrored into `status` for filtering.
    #[serde(default = "default_is_active")]
    pub is_active: bool,

    /// Aggregate count of times this template has been used.
    #[serde(default)]
    pub usage_count: i64,

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
