//! On-disk shape of a `meet_dialins` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DialIn {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// e.g. `"US"`, `"IN"`, `"GB-LDN"`.
    pub region_code: String,
    /// Human label e.g. `"United States — Toll"`.
    pub label: String,
    /// E.164 phone number, e.g. `"+14155551234"`.
    pub phone_number: String,

    /// `"required"` | `"optional"` | `"none"`.
    pub pin_policy: String,

    #[serde(default, skip_serializing_if = "is_false")]
    pub toll_free: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_default: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,

    /// `true` = visible to room participants; `false` = soft-deleted/inactive.
    #[serde(default = "default_active")]
    pub active: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_active() -> bool {
    true
}
