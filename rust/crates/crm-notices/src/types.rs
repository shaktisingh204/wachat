//! On-disk shape of a `crm_notices` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmNotice {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human-readable notice identifier, e.g. `"NOT-001"`. Auto-generated
    /// from the last six digits of the current epoch ms if not supplied.
    pub notice_number: String,

    pub title: String,
    pub body: String,

    /// `"general"` | `"safety"` | `"compliance"` | `"closure"` | `"meeting"` | `"emergency"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// Optional external reference (e.g. internal memo number).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_number: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_by_name: Option<String>,

    /// Recipient scope: `"all"` | `"department"` | `"team"` | `"role"` | `"individual"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_to: Option<String>,
    #[serde(default)]
    pub recipient_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_from: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_until: Option<BsonDateTime>,

    #[serde(default)]
    pub require_acknowledgement: bool,
    #[serde(default)]
    pub acknowledgement_count: i64,

    /// `"info"` | `"warning"` | `"critical"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,

    /// SabFile references (URLs / file IDs from the SabFiles library).
    #[serde(default)]
    pub attachments: Vec<String>,

    /// `"draft"` | `"issued"` | `"acknowledged"` | `"superseded"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub superseded_by: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
