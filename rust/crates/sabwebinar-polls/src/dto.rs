//! Request / response DTOs for the sabwebinar-polls HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::Poll;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub webinar_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePollInput {
    pub webinar_id: String,
    pub question: String,
    pub options: Vec<String>,
    #[serde(default)]
    pub anonymous: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePollInput {
    #[serde(default)]
    pub question: Option<String>,
    /// `"draft"` | `"open"` | `"closed"`.
    #[serde(default)]
    pub status: Option<String>,
}

/// Public — unauthenticated vote.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VotePollInput {
    pub option_id: String,
    /// Voter handle (display name or join_token); ignored when poll is anonymous.
    #[serde(default)]
    pub voter: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePollResponse {
    pub id: String,
    pub entity: Poll,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Poll>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
