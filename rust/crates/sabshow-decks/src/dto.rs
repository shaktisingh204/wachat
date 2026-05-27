//! Request / response DTOs for the SabShow decks HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::{DeckStatus, SabshowDeck};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDecksQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free text — matched against `title`.
    #[serde(default)]
    pub q: Option<String>,
    /// `"draft" | "published" | "archived" | "all"`. Defaults to non-archived.
    #[serde(default)]
    pub status: Option<String>,
    /// `"owned" | "shared" | "all"`. Defaults to `all`.
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeckInput {
    pub title: String,
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeckInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub default_slide_id: Option<String>,
    #[serde(default)]
    pub cover_file_id: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<DeckStatus>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareDeckInput {
    /// User IDs to add to `sharedWithUserIds`.
    #[serde(default)]
    pub add_user_ids: Vec<String>,
    /// User IDs to remove from `sharedWithUserIds`.
    #[serde(default)]
    pub remove_user_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckEnvelope {
    pub deck: SabshowDeck,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckListResponse {
    pub items: Vec<SabshowDeck>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}
