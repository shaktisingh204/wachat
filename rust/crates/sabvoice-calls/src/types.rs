//! On-disk shape of a `sabvoice_calls` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceCall {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub from_number: String,
    pub to_number: String,

    /// `"inbound"` | `"outbound"`.
    pub direction: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub queue_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ivr_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub did_id: Option<ObjectId>,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,
    pub duration_secs: u32,

    /// `"completed"` | `"missed"` | `"abandoned"` | `"voicemail"` | `"failed"`.
    pub status: String,

    /// SabFile reference for the call recording audio.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recording_file_id: Option<String>,

    /// `"twilio"` | `"plivo"` | `"mock"`.
    pub provider: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_call_sid: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
