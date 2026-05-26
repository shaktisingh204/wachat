use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    pub agent_id: String,
    pub conversation_id: String,
    pub provider_update_id: String,

    #[serde(default)]
    pub from_name: Option<String>,

    #[serde(default)]
    pub text: Option<String>,

    #[serde(default)]
    pub photo_url: Option<String>,

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

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredReq {
    pub agent_id: String,
    pub conversation_id: String,
    pub provider_update_id: String,
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveredResp {
    pub conversation_id: String,
    pub message_id: String,
    #[serde(default)]
    pub deduped: bool,
}
