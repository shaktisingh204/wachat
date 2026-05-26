//! On-disk shape of a `sabvoice_agents_presence` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentPresence {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant id.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// The agent's own user id.
    pub agent_user_id: ObjectId,

    /// `"available"` | `"busy"` | `"away"` | `"offline"`.
    pub status: String,

    /// CDR id if currently on a call.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_call_id: Option<ObjectId>,

    /// Queue ids this agent is currently logged into.
    #[serde(default)]
    pub queue_ids: Vec<ObjectId>,

    pub last_change_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}
