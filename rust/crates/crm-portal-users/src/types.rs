//! On-disk shape of a `crm_portal_users` document.
//!
//! Only the BFF-visible fields. Anything auth-managed (passwordHash, magic
//! link tokens, sessions, etc.) is deliberately omitted so this crate cannot
//! accidentally read or write credential material.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPortalUser {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contact_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<ObjectId>,

    /// `"viewer"` | `"editor"` | `"admin"`.
    pub role: String,
    /// `"active"` | `"disabled"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_login_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invite_sent_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
