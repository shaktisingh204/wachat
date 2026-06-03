//! Wire-format DTOs for the SabChat Viber channel-adapter endpoints.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` to round-trip
//! with the camelCase JSON the Next.js side sends.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    /// Matches `channelConfig.settings.accountId` on a `viber` inbox.
    pub account_id: String,

    /// Visitor's Viber user id.
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

    #[serde(default)]
    pub location_lat: Option<f64>,

    #[serde(default)]
    pub location_lon: Option<f64>,

    #[serde(default)]
    pub contact_name: Option<String>,

    #[serde(default)]
    pub contact_phone: Option<String>,

    #[serde(default)]
    pub sticker_id: Option<String>,

    /// Idempotency token for the message.
    pub provider_message_token: String,

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
// `POST /subscribed`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedReq {
    pub account_id: String,
    pub user_id: String,
    #[serde(default)]
    pub user_name: Option<String>,
    pub provider_event_token: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedResp {
    pub conversation_id: String,
    pub message_id: String,
    #[serde(default)]
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /unsubscribed`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribedReq {
    pub account_id: String,
    pub user_id: String,
    pub provider_event_token: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribedResp {
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
    pub provider_message_token: String,
    /// `delivered`, `seen`, or `failed`
    pub status: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredResp {
    pub message_id: Option<String>,
}
