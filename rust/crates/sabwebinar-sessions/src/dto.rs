//! Request / response DTOs for the sabwebinar-sessions HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::Session;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub webinar_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub webinar_id: String,
    #[serde(default)]
    pub stream_url: Option<String>,
    #[serde(default)]
    pub sfu_room_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionInput {
    #[serde(default)]
    pub ended_at: Option<String>,
    #[serde(default)]
    pub peak_concurrent: Option<u32>,
    #[serde(default)]
    pub stream_url: Option<String>,
    #[serde(default)]
    pub sfu_room_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub id: String,
    pub entity: Session,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Session>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
