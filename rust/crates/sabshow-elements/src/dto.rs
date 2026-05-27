//! Request / response DTOs for the SabShow elements HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::{ElementKind, SabshowElement};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListElementsQuery {
    /// Either `slideId` (preferred) or `deckId` is required.
    #[serde(default)]
    pub slide_id: Option<String>,
    #[serde(default)]
    pub deck_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateElementInput {
    pub slide_id: String,
    pub kind: ElementKind,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    #[serde(default)]
    pub rotation: Option<f64>,
    #[serde(default)]
    pub z_index: Option<i32>,
    #[serde(default)]
    pub config_json: Option<JsonValue>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateElementInput {
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub w: Option<f64>,
    #[serde(default)]
    pub h: Option<f64>,
    #[serde(default)]
    pub rotation: Option<f64>,
    #[serde(default)]
    pub z_index: Option<i32>,
    #[serde(default)]
    pub locked: Option<bool>,
    #[serde(default)]
    pub config_json: Option<JsonValue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementEnvelope {
    pub element: SabshowElement,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementListResponse {
    pub items: Vec<SabshowElement>,
}
