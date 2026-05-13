//! Request DTOs — what callers send IN.
//!
//! Responses use the full [`crate::types::CrmContact`].

use serde::{Deserialize, Serialize};

/// `GET /v1/crm/contacts?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 0-indexed page (matches the `makeCrmClient` factory shape).
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to `crm_common::DEFAULT_LIMIT`, clamped to MAX_LIMIT.
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text. Searched across `name`, `email`, `company`, `phone`.
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/contacts` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactInput {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub lead_score: Option<i64>,
    #[serde(default)]
    pub lead_source: Option<String>,
    #[serde(default)]
    pub assigned_to: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub twitter_handle: Option<String>,
    #[serde(default)]
    pub lifecycle_stage: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub date_of_birth: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub timezone: Option<String>,
}

/// `PATCH /v1/crm/contacts/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    /// Allow lifecycle transitions via PATCH (status: "active" |
    /// "archived" | one of the TS-enum values).
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub lead_score: Option<i64>,
    #[serde(default)]
    pub lead_source: Option<String>,
    #[serde(default)]
    pub assigned_to: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub twitter_handle: Option<String>,
    #[serde(default)]
    pub lifecycle_stage: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub date_of_birth: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub timezone: Option<String>,
}

/// `POST /v1/crm/contacts` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactResponse {
    pub id: String,
    /// Echo of the inserted doc (with `_id` filled in).
    pub entity: crate::types::CrmContact,
}

/// `DELETE /v1/crm/contacts/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteContactResponse {
    pub deleted: bool,
}
