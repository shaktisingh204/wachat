//! Request DTOs — what callers send IN.
//!
//! Responses use the full [`crate::types::CrmAccount`].

use serde::{Deserialize, Serialize};

/// `GET /v1/crm/accounts?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 0-indexed page (matches the `makeCrmClient` factory shape).
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to `crm_common::DEFAULT_LIMIT`, clamped to MAX_LIMIT.
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text. Searched across `name`, `industry`, `website`.
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/accounts` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountInput {
    pub name: String,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub billing_address: Option<String>,
    #[serde(default)]
    pub shipping_address: Option<String>,
    #[serde(default)]
    pub annual_revenue: Option<f64>,
    #[serde(default)]
    pub employee_count: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub payment_terms: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
}

/// `PATCH /v1/crm/accounts/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub billing_address: Option<String>,
    #[serde(default)]
    pub shipping_address: Option<String>,
    #[serde(default)]
    pub annual_revenue: Option<f64>,
    #[serde(default)]
    pub employee_count: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub payment_terms: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
    /// Allow lifecycle transitions via PATCH (status: "active" | "archived").
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/accounts` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountResponse {
    pub id: String,
    /// Echo of the inserted doc (with `_id` filled in).
    pub entity: crate::types::CrmAccount,
}

/// `DELETE /v1/crm/accounts/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAccountResponse {
    pub deleted: bool,
}
