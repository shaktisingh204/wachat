//! On-disk shape of a `sabvault_shares` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum GranteeType {
    #[default]
    User,
    Team,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum SharePermission {
    /// Reveal/copy only, no edit.
    #[default]
    Read,
    /// Auto-fill / use without revealing the underlying secret string.
    Use,
    /// Read + rotate/edit the ciphertext.
    Edit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabvaultShare {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Owner of the secret (tenant scoping anchor — only owners can grant).
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub secret_id: ObjectId,
    pub grantee_type: GranteeType,
    pub grantee_id: ObjectId,
    pub permission: SharePermission,

    pub granted_by: ObjectId,
    #[serde(rename = "grantedAt")]
    pub granted_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revoked_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revoked_by: Option<ObjectId>,

    /// Optional re-wrapped ciphertext blob — when grantee has their own
    /// key, the owner re-encrypts the payload to that key and stashes it
    /// here. Opaque to the server.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rewrapped_payload_b64: Option<String>,
}
