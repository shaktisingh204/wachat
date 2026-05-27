//! Request / response DTOs for the SabShow publications HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::{PublicationStatus, SabshowPublication};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishDeckInput {
    pub deck_id: String,
    pub slug: String,
    /// Optional version to pin. Defaults to the deck's current `version`.
    #[serde(default)]
    pub version: Option<u32>,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub cover_file_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePublicationInput {
    #[serde(default)]
    pub status: Option<PublicationStatus>,
    #[serde(default)]
    pub published_version: Option<u32>,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub cover_file_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPublicationsQuery {
    /// Filter to a specific deck.
    #[serde(default)]
    pub deck_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationEnvelope {
    pub publication: SabshowPublication,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationListResponse {
    pub items: Vec<SabshowPublication>,
}

/// Public (UNAUTHENTICATED) response — what the `/present/[slug]` page
/// gets back. Strips owner identity from the public payload.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPublicationResponse {
    pub slug: String,
    pub deck_id: String,
    pub published_version: u32,
    pub theme_json: Option<JsonValue>,
    pub custom_css: Option<String>,
    pub cover_file_id: Option<String>,
}
