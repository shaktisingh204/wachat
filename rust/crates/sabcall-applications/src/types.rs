//! On-disk shape of a `sabcall_applications` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceApplication {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Friendly application name.
    pub name: String,

    /// What this application does on a call.
    /// `"webhook"` | `"ivr"` | `"queue"` | `"dial"` | `"autopilot"`.
    /// Stored under the BSON key `"type"`.
    #[serde(rename = "type")]
    pub app_type: String,

    /// For `type = "webhook"` — the URL invoked when a call lands.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,

    /// For `type = "ivr"` — the IVR flow to run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ivr_id: Option<ObjectId>,

    /// For `type = "queue"` — the queue to enter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub queue_id: Option<ObjectId>,

    /// For `type = "dial"` — an E.164 number or SIP URI to dial.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dial_target: Option<String>,

    /// URL invoked when the primary handler fails.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fallback_url: Option<String>,

    /// Whether calls hitting this application are recorded.
    #[serde(default)]
    pub record_calls: bool,

    /// Whether speech-to-text transcription is enabled.
    #[serde(default)]
    pub stt_enabled: bool,

    /// Text-to-speech voice identifier.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tts_voice: Option<String>,

    /// `"active"` | `"disabled"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
