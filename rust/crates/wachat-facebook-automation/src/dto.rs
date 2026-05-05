//! Wire-format DTOs for the Facebook automation router.
//!
//! Every body uses `serde(rename_all = "camelCase")` so the wire shape
//! matches the legacy TS `FormData` keys (`projectId`, `replyMode`,
//! `aiReplyPrompt`, …) — the TS shim that wraps these endpoints converts
//! its `FormData` into JSON and the field names line up.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ===========================================================================
// Common envelopes
// ===========================================================================

/// Mirrors the TS `{ success: true } | { success: false, error }` shape
/// that the legacy server actions returned. We surface this verbatim so
/// the form action call sites do not need to change.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OkResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub error: Option<String>,
}

/// Mirrors the TS `{ message?, error? }` shape for broadcast / live-stream
/// endpoints.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MessageResult {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub error: Option<String>,
}

// ===========================================================================
// Automation settings
// ===========================================================================

/// Body for `POST /projects/{project_id}/automation` —
/// `handleUpdateFacebookAutomationSettings`. The TS form sent two
/// distinct shapes keyed by `automationType`; we keep the union open by
/// passing every optional field as `Option<_>` and validate at the
/// handler boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAutomationSettingsBody {
    /// `"comment"` or `"welcome"`.
    pub automation_type: String,

    pub enabled: Option<bool>,

    // -- comment auto-reply -------------------------------------------------
    /// `"static"` | `"ai"`.
    pub reply_mode: Option<String>,
    pub static_reply_text: Option<String>,
    pub ai_reply_prompt: Option<String>,
    pub moderation_enabled: Option<bool>,
    pub moderation_prompt: Option<String>,

    // -- welcome message ---------------------------------------------------
    pub message: Option<String>,
    /// Open-ended array; the TS stored whatever the form gave it. We
    /// keep the structure as a `Value` so we don't lose any extra keys
    /// the UI starts sending.
    pub quick_replies: Option<Value>,
}

// ===========================================================================
// Post randomizer
// ===========================================================================

/// Body for `POST /projects/{project_id}/randomizer/settings` —
/// `saveRandomizerSettings`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRandomizerSettingsBody {
    pub enabled: bool,
    pub frequency_hours: f64,
}

/// Body for `POST /projects/{project_id}/randomizer/posts` —
/// `addRandomizerPost`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRandomizerPostBody {
    pub message: String,
    /// Optional. The TS only inserted the field when truthy; we mirror
    /// that with `skip_serializing_if = Option::is_none` on the doc
    /// builder side rather than here.
    #[serde(default)]
    pub image_url: Option<String>,
}

/// `GET` response wrapper for randomizer posts list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomizerPostsResponse {
    pub posts: Vec<Value>,
}

// ===========================================================================
// Broadcasts
// ===========================================================================

/// `GET` response wrapper for the broadcasts list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookBroadcastsResponse {
    pub broadcasts: Vec<Value>,
}

/// Body for `POST /projects/{project_id}/broadcasts` —
/// `handleSendFacebookBroadcast`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBroadcastBody {
    pub message: String,
}

// ===========================================================================
// Live streams
// ===========================================================================

/// `GET` response wrapper for the scheduled live streams list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveStreamsResponse {
    pub streams: Vec<Value>,
}

/// Body for `POST /projects/{project_id}/live-streams` —
/// `handleScheduleLiveStream`. The legacy TS handler took a multipart
/// `FormData` carrying the video file directly; the Rust port keeps the
/// multipart endpoint (axum extractor parses it into the strongly-typed
/// fields below) so we don't need an extra round-trip to upload the
/// file separately.
///
/// This struct is **not** serialized over the wire — it's documentation
/// for the multipart fields the handler reads. See the matching handler
/// for the actual extraction.
#[derive(Debug, Clone)]
pub struct ScheduleLiveStreamFields {
    pub title: String,
    pub description: String,
    /// `YYYY-MM-DD`.
    pub scheduled_date: String,
    /// `HH:MM[:SS]`.
    pub scheduled_time: String,
    pub video_filename: String,
    pub video_content_type: String,
    pub video_bytes: Vec<u8>,
}
