//! Request / response DTOs for the sabwebinar-registrations HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::Registration;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub webinar_id: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

/// **Public** registration input — POST'd by the landing form (no auth).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRegistrationInput {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub custom_fields: Option<serde_json::Value>,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRegistrationInput {
    #[serde(default)]
    pub joined_at: Option<String>,
    #[serde(default)]
    pub left_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRegistrationResponse {
    pub id: String,
    pub join_token: String,
    pub entity: Registration,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Registration>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
