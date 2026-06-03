use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    /// Matches `channelConfig.settings.accountId` on an `apple` inbox.
    pub account_id: String,

    /// Visitor's opaque Apple user id.
    pub user_id: String,

    /// Optional display name.
    #[serde(default)]
    pub user_name: Option<String>,

    /// Plain message text.
    #[serde(default)]
    pub text: Option<String>,

    #[serde(default)]
    pub image_url: Option<String>,

    #[serde(default)]
    pub video_url: Option<String>,

    #[serde(default)]
    pub audio_url: Option<String>,

    #[serde(default)]
    pub file_url: Option<String>,

    #[serde(default)]
    pub file_name: Option<String>,

    /// Idempotency token for the message.
    pub provider_message_id: String,

    /// Optional RFC 3339 timestamp.
    #[serde(default)]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestResp {
    pub conversation_id: String,
    pub message_id: String,
    #[serde(default)]
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /delivered`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredReq {
    pub account_id: String,
    pub user_id: String,
    pub provider_message_id: String,
    /// `delivered`, `read`, or `failed`
    pub status: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredResp {
    pub message_id: Option<String>,
}
