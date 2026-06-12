//! Request DTOs — what callers send IN.
//!
//! Responses use the full [`crate::types::CrmVendor`].

use serde::{Deserialize, Serialize};

use crate::types::BankAccountDetails;

/// `GET /v1/crm/vendors?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 0-indexed page (matches the `makeCrmClient` factory shape).
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to `crm_common::DEFAULT_LIMIT`, clamped to MAX_LIMIT.
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text. Searched across `name`, `gstin`, `email`, `phone`.
    #[serde(default)]
    pub q: Option<String>,
    /// SabCRM suite scope — required on `/v1/sabcrm/supply/*` mounts,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Query for single-document routes (`GET`/`PATCH`/`DELETE /{id}`) —
/// carries the SabCRM `projectId` on project-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/vendors` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVendorInput {
    pub name: String,
    /// SabCRM suite scope — required on project-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    /// Hex `ObjectId`. Validated/parsed at the handler boundary.
    #[serde(default)]
    pub industry_id: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub pincode: Option<String>,
    #[serde(default)]
    pub street: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub pan_name: Option<String>,
    #[serde(default)]
    pub vendor_type: Option<String>,
    #[serde(default)]
    pub tax_treatment: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub bank_account_details: Option<BankAccountDetails>,
    #[serde(default)]
    pub show_email_in_invoice: Option<bool>,
    #[serde(default)]
    pub show_phone_in_invoice: Option<bool>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
}

/// `PATCH /v1/crm/vendors/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVendorInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub industry_id: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub pincode: Option<String>,
    #[serde(default)]
    pub street: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub pan_name: Option<String>,
    #[serde(default)]
    pub vendor_type: Option<String>,
    #[serde(default)]
    pub tax_treatment: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub bank_account_details: Option<BankAccountDetails>,
    #[serde(default)]
    pub show_email_in_invoice: Option<bool>,
    #[serde(default)]
    pub show_phone_in_invoice: Option<bool>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
}

/// `POST /v1/crm/vendors` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVendorResponse {
    pub id: String,
    /// Echo of the inserted doc (with `_id` filled in).
    pub entity: crate::types::CrmVendor,
}

/// `DELETE /v1/crm/vendors/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVendorResponse {
    pub deleted: bool,
}
