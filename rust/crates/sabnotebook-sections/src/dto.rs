//! Request / response DTOs for SabNotebook sections.

use serde::{Deserialize, Serialize};

use crate::types::SabnotebookSection;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub notebook_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSectionInput {
    pub notebook_id: String,
    pub name: String,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSectionInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSectionResponse {
    pub id: String,
    pub entity: SabnotebookSection,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSectionResponse {
    pub deleted: bool,
}
