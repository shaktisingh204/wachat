//! On-disk shape of a `sabcall_acls` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SipAcl {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Friendly name for the rule.
    pub name: String,

    /// `"allow"` | `"deny"`.
    pub action: String,

    /// The set of CIDRs this rule matches (e.g. `["10.0.0.0/8", "203.0.113.4/32"]`).
    #[serde(default)]
    pub cidrs: Vec<String>,

    /// What traffic this rule applies to — `"trunk"` | `"registration"` | `"all"`.
    pub applies_to: String,

    /// `"active"` | `"disabled"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
