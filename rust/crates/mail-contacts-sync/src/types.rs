//! On-disk shape of `mail_contacts_sync`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MailContact {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub account_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    /// All known addresses for this contact. First is canonical.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub emails: Vec<String>,

    /// Updated on every send/receive interaction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<BsonDateTime>,

    /// Send/receive count for ranking.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub send_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receive_count: Option<u32>,

    /// `active` | `archived`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
