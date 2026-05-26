//! On-disk shape of a `meet_recordings` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptCue {
    /// Seconds from recording start.
    pub start_sec: f32,
    pub end_sec: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub room_id: ObjectId,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,

    /// SabFiles file id holding the encoded media. None until processing finishes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    /// Optional separate audio-only file id (for podcast-style export).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_file_id: Option<String>,
    /// Optional SabFiles id for an SRT/VTT transcript file.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_file_id: Option<String>,
    /// Inline transcript cues (also stored in transcriptFileId when large).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub transcript: Vec<TranscriptCue>,

    /// `"recording"` | `"processing"` | `"ready"` | `"failed"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
