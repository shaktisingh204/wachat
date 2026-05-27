//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub location_id: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
    /// `"all"` | `"unreplied"`. Defaults to `"all"`.
    #[serde(default)]
    pub filter: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestReviewInput {
    pub location_id: String,
    pub provider_id: String,
    pub external_review_id: String,
    pub rating: u8,
    #[serde(default)]
    pub reviewer_name: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    /// Epoch millis.
    pub posted_at_ms: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyReviewInput {
    pub reply_body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestReviewResponse {
    pub id: String,
    pub entity: crate::types::SabpublishReview,
}
