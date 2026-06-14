//! On-disk shape of a `sabcall_domains` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SipDomain {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// The SIP domain (e.g. `acme.sip.sabnode.com`), lowercased and trimmed.
    pub domain: String,

    /// Friendly label users can attach.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,

    /// Whether calls on this domain are recorded.
    #[serde(default)]
    pub record_calls: bool,

    /// Optional default application to dispatch calls to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_application_id: Option<ObjectId>,

    /// `"active"` | `"disabled"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
