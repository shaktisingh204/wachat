//! On-disk shape of `sabmail_aliases`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailAlias {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// FK → `sabmail_domains._id`.
    pub domain_id: ObjectId,

    /// Source address. `sales@acme.com` etc. Stored lower-case.
    pub source_address: String,

    /// Receiving mailbox account ids.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub target_account_ids: Vec<ObjectId>,

    /// Optional external forwards (raw addresses).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub external_targets: Vec<String>,

    /// `active` | `archived`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
