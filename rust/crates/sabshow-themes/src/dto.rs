//! Request / response DTOs for the SabShow themes HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::SabshowTheme;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListThemesQuery {
    #[serde(default)]
    pub include_built_in: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateThemeInput {
    pub name: String,
    #[serde(default)]
    pub config_json: Option<JsonValue>,
    #[serde(default)]
    pub preview_file_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateThemeInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub config_json: Option<JsonValue>,
    #[serde(default)]
    pub preview_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeEnvelope {
    pub theme: SabshowTheme,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeListResponse {
    pub items: Vec<SabshowTheme>,
}
