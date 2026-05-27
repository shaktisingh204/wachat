use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStatusPageInput {
    pub slug: String,
    pub title: String,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub check_ids: Vec<String>,
    #[serde(default)]
    pub show_historical_uptime: bool,
    #[serde(default)]
    pub custom_header: Option<String>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatusPageInput {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub theme_json: Option<JsonValue>,
    #[serde(default)]
    pub check_ids: Option<Vec<String>>,
    #[serde(default)]
    pub show_historical_uptime: Option<bool>,
    #[serde(default)]
    pub custom_header: Option<String>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStatusPageResponse {
    pub id: String,
    pub entity: crate::types::SabmonitorStatusPage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStatusPageResponse { pub deleted: bool }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorStatusPage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStatusPageView {
    pub slug: String,
    pub title: String,
    pub theme_json: Option<JsonValue>,
    pub custom_header: Option<String>,
    pub custom_css: Option<String>,
    pub show_historical_uptime: bool,
    pub checks: Vec<PublicCheckView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCheckView {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub last_status: String,
}
