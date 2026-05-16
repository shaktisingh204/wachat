//! On-disk shape of a `crm_settings` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSetting {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Setting key — unique within the `(userId, key)` pair. Required.
    pub key: String,

    /// Free-form value blob (JSON object). The shape is owned by the caller.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Document>,

    /// Optional grouping bucket (e.g. `"general"`, `"sales"`, `"inventory"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// Human-readable description shown in the admin UI.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `true` if the value contains a credential / API token / similar
    /// sensitive material — UI redacts these by default.
    #[serde(default)]
    pub is_secret: bool,

    /// `true` if this setting is currently in effect. Distinct from
    /// `status` so callers can toggle a setting on/off without
    /// archiving it.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}

fn default_status() -> String {
    "active".to_owned()
}
