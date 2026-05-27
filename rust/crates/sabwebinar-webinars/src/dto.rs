//! Request / response DTOs for the sabwebinar-webinars HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::{LandingTheme, Webinar};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"draft"` | `"scheduled"` | `"live"` | `"ended"` | `"cancelled"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// `"upcoming"` (default), `"past"`, `"live"`, `"all"`.
    #[serde(default)]
    pub when: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebinarInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub host_user_id: Option<String>,
    #[serde(default)]
    pub host_name: Option<String>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<u32>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub landing_theme: Option<LandingTheme>,
    #[serde(default)]
    pub hero_file_id: Option<String>,
    #[serde(default)]
    pub require_registration: Option<bool>,
    #[serde(default)]
    pub capacity: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWebinarInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub host_name: Option<String>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<u32>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub landing_theme: Option<LandingTheme>,
    #[serde(default)]
    pub hero_file_id: Option<String>,
    #[serde(default)]
    pub recording_file_id: Option<String>,
    #[serde(default)]
    pub require_registration: Option<bool>,
    #[serde(default)]
    pub capacity: Option<u32>,
    /// Lifecycle: `draft` → `scheduled` → `live` → `ended` (or `cancelled`).
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebinarResponse {
    pub id: String,
    pub entity: Webinar,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWebinarResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Webinar>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
