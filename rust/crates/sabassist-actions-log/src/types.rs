//! On-disk shape of a `sabassist_actions_log` document.
//!
//! Append-only: there are no update / delete routes. Each entry captures
//! one user-visible action in a SabAssist session along with a free-form
//! JSON payload.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabassistActionLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant id — same as session.user_id.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub session_id: ObjectId,

    pub ts: BsonDateTime,

    /// Whoever performed the action. May be the technician, the customer,
    /// or "system" — when unknown, persist the technician user id.
    pub actor_user_id: ObjectId,

    /// `"connect"` | `"disconnect"` | `"elevate"` | `"file_transfer"`
    /// | `"annotation"` | `"reboot_request"`.
    pub action: String,

    /// Arbitrary action-specific payload (e.g. file id, x/y/colour for an
    /// annotation, target privilege level for an elevate).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_json: Option<bson::Bson>,
}
