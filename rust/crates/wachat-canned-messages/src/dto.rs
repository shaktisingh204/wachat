//! Wire DTOs for the canned-messages endpoints. `camelCase` to match the
//! JSON the `/wachat/settings/canned` page (and its form dialog) sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Nested `content` block for create / update bodies.
///
/// For `text` messages the page sends `text`; for media messages it sends
/// `mediaUrl` plus optional `caption` / `fileName`. All fields are optional
/// on the wire so a single struct serves every message type.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CannedContent {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub media_url: Option<String>,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
}

/// Body for `POST /{project_id}` (create) and `PUT /{project_id}/{message_id}`
/// (update).
///
/// The form dialog posts `name`, `type`, then either a top-level `text` (text
/// messages) or `mediaUrl` / `caption` / `fileName` (media messages). We accept
/// both the flattened top-level media fields and a nested `content` object so
/// the crate is robust to either client encoding.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CannedMessageBody {
    /// Unique label identifying this snippet (e.g. "Welcome Message").
    pub name: String,
    /// Message type: `text` | `image` | `video` | `audio` | `document`.
    pub r#type: String,
    /// Nested content block (optional; top-level fields below also accepted).
    #[serde(default)]
    pub content: Option<CannedContent>,
    /// Text body (text messages) — top-level convenience field.
    #[serde(default)]
    pub text: Option<String>,
    /// Media URL (media messages) — top-level convenience field.
    #[serde(default)]
    pub media_url: Option<String>,
    /// Optional caption for media messages.
    #[serde(default)]
    pub caption: Option<String>,
    /// Optional file name for `document` messages.
    #[serde(default)]
    pub file_name: Option<String>,
    /// Pins this message to the top of the list when `true`.
    #[serde(default)]
    pub is_favourite: bool,
}

impl CannedMessageBody {
    /// Resolve the effective text, preferring the nested `content` block.
    pub fn resolved_text(&self) -> Option<&str> {
        self.content
            .as_ref()
            .and_then(|c| c.text.as_deref())
            .or(self.text.as_deref())
            .filter(|s| !s.is_empty())
    }

    /// Resolve the effective media URL, preferring the nested `content` block.
    pub fn resolved_media_url(&self) -> Option<&str> {
        self.content
            .as_ref()
            .and_then(|c| c.media_url.as_deref())
            .or(self.media_url.as_deref())
            .filter(|s| !s.is_empty())
    }

    /// Resolve the effective caption.
    pub fn resolved_caption(&self) -> Option<&str> {
        self.content
            .as_ref()
            .and_then(|c| c.caption.as_deref())
            .or(self.caption.as_deref())
            .filter(|s| !s.is_empty())
    }

    /// Resolve the effective file name.
    pub fn resolved_file_name(&self) -> Option<&str> {
        self.content
            .as_ref()
            .and_then(|c| c.file_name.as_deref())
            .or(self.file_name.as_deref())
            .filter(|s| !s.is_empty())
    }
}

/// Response for `GET /{project_id}` — the project's canned messages as cleaned
/// JSON docs (already sorted favourites-first, then by name).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

/// Body for `PUT /{project_id}/settings`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CannedSettingsBody {
    /// Share canned messages with the account's other sub-projects.
    #[serde(default)]
    pub sync_across_projects: bool,
    /// Keyboard shortcut that opens the canned-messages menu (e.g. "Cmd + /").
    #[serde(default)]
    pub keyboard_trigger: Option<String>,
}

/// Response for `GET /{project_id}/settings`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CannedSettingsResponse {
    pub sync_across_projects: bool,
    pub keyboard_trigger: String,
}

/// `{ success: true }` envelope for create / update / delete / settings writes.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
