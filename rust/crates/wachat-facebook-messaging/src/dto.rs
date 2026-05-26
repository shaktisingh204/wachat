//! Wire-shape DTOs for the Messenger slice.
//!
//! The TS server actions return open `FacebookConversation[]` /
//! `FacebookMessage[]` shapes — Meta's payload is nested and grows
//! over time. We model the Graph response bodies with `serde_json::Value`
//! pass-through so a Meta schema bump never breaks the wire contract.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Inbox / list
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ConversationsResp {
    pub conversations: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SearchQuery {
    /// Substring to match against participant name or `snippet`.
    pub query: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MessagesResp {
    pub messages: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatInitialDataResp {
    pub project: Option<Value>,
    pub conversations: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AckResp {
    pub success: bool,
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SendTextBody {
    /// PSID (page-scoped user id).
    pub recipient_id: String,
    pub message_text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendMediaBody {
    pub recipient_id: String,
    /// `image` | `video` | `audio` | `file`.
    pub media_type: String,
    /// Public URL or pre-uploaded media id. Raw binary uploads happen in
    /// the TS shim before this endpoint is hit.
    pub media_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ButtonTemplateButton {
    /// `web_url` | `postback`.
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendButtonTemplateBody {
    pub recipient_id: String,
    pub text: String,
    pub buttons: Vec<ButtonTemplateButton>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendGenericTemplateBody {
    pub recipient_id: String,
    /// Free-form generic-template elements. Forwarded verbatim to Meta —
    /// the legacy TS code accepted any shape under `elements[]`.
    pub elements: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QuickReplyItem {
    /// `text` | `user_phone_number` | `user_email`.
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendQuickRepliesBody {
    pub recipient_id: String,
    pub text: String,
    pub quick_replies: Vec<QuickReplyItem>,
}

// ---------------------------------------------------------------------------
// Handover protocol
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct PassThreadBody {
    pub psid: String,
    pub target_app_id: String,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ThreadControlBody {
    pub psid: String,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecondaryReceiversResp {
    pub receivers: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct OneTimeNotifRequestBody {
    pub psid: String,
    pub title: String,
    pub payload: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OneTimeNotifSendBody {
    /// `one_time_notif_token` returned by Meta when the user opted in.
    pub token: String,
    pub message_text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecurringOptInBody {
    pub psid: String,
    pub title: String,
    pub image_url: String,
    pub payload: String,
    /// `DAILY` | `WEEKLY` | `MONTHLY`.
    pub frequency: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecurringSendBody {
    /// `notification_messages_token` returned when the user opts in.
    pub token: String,
    pub message_text: String,
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SendWhatsappTextBody {
    pub phone_number_id: String,
    pub to: String,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendWhatsappTemplateBody {
    pub phone_number_id: String,
    pub to: String,
    pub template_name: String,
    pub language_code: String,
    #[serde(default)]
    pub components: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendWhatsappMediaBody {
    pub phone_number_id: String,
    pub to: String,
    pub media_type: String, // "image", "video", "audio", "document"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendWhatsappInteractiveBody {
    pub phone_number_id: String,
    pub to: String,
    pub interactive: Value,
}
