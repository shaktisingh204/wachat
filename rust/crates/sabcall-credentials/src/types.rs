//! On-disk shape of a `sabcall_credentials` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SipCredential {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SIP auth username the device registers with.
    pub username: String,

    /// Reference to the secret holding the SIP password — never the raw value.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_ref: Option<String>,

    /// SIP domain this credential registers against.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub domain_id: Option<ObjectId>,

    /// Friendly label users can attach.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,

    /// The person this credential belongs to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_user_id: Option<ObjectId>,

    /// Codecs this device negotiates, in preference order.
    #[serde(default)]
    pub codecs: Vec<String>,

    /// `"active"` | `"disabled"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
