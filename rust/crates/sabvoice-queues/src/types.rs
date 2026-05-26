//! On-disk shape of a `sabvoice_queues` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceQueue {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"round_robin"` | `"least_busy"` | `"simultaneous"`.
    pub strategy: String,

    /// Agent user ids assigned to this queue.
    #[serde(default)]
    pub agent_ids: Vec<ObjectId>,

    /// Maximum time (seconds) a caller waits before fallback fires.
    pub max_wait_secs: u32,

    /// `"voicemail"` | `"hangup"` | `"forward"` | IVR/queue id reference.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fallback: Option<String>,

    /// SabFile id for the hold-music audio (greeting / on-hold loop).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hold_music_file_id: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
