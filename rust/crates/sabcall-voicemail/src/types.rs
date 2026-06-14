//! On-disk shape of a `sabcall_voicemail` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceVoicemail {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Originating call id (CDR).
    pub call_id: ObjectId,

    pub from_number: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_number: Option<String>,

    /// SabFile reference for the voicemail audio.
    pub audio_file_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,

    /// ASR transcript, populated asynchronously when the transcription
    /// job finishes — null until then.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,

    /// User ids who have listened to this voicemail.
    #[serde(default)]
    pub listened_by: Vec<ObjectId>,

    /// `"new"` | `"listened"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
