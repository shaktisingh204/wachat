//! On-disk shape of `sabmail_accounts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailAccount {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// FK → `sabmail_domains._id`.
    #[serde(rename = "domainId")]
    pub domain_id: ObjectId,

    /// LHS of the email address. `"alice"` for `alice@acme.com`.
    pub local_part: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    /// Set when the integrator wires a provider — kept opaque otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_hash: Option<String>,

    /// MB. UI exposes a slider.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quota_mb: Option<u32>,

    /// `active` | `suspended` | `archived`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Convenience for clients — full address. Stored denormalized.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email_address: Option<String>,

    /// Forwarding target (optional). Free-form email.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forwarding_address: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
