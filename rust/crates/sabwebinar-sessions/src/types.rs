//! On-disk shape of a `sabwebinar_sessions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub webinar_id: ObjectId,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,

    #[serde(default)]
    pub peak_concurrent: u32,

    /// HLS / RTMP / WebRTC URL placeholder. Provided by the live-stream
    /// transport binding (Mock today; Mux / Cloudflare Stream / LiveKit
    /// Egress later).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_url: Option<String>,

    /// Optional SFU room id the live console attaches to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sfu_room_id: Option<String>,
}
