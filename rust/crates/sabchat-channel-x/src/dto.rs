use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    pub account_id: String,

    pub sender_id: String,

    #[serde(default)]
    pub sender_username: Option<String>,

    #[serde(default)]
    pub sender_name: Option<String>,

    #[serde(default)]
    pub text: Option<String>,

    #[serde(default)]
    pub media_url: Option<String>,

    pub provider_update_id: String,

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
    pub provider_message_id: String,
    #[serde(default)]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredResp {
    pub success: bool,
}
