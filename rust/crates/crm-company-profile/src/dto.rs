//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmCompanyProfile;

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
    pub status: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCompanyProfileInput {
    pub legal_name: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub short_name: Option<String>,
    #[serde(default)]
    pub tagline: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub favicon_url: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub industry_id: Option<String>,
    #[serde(default)]
    pub founded_year: Option<i32>,
    #[serde(default)]
    pub employee_count_band: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub fax: Option<String>,
    #[serde(default)]
    pub registered_address: Option<Document>,
    #[serde(default)]
    pub billing_address: Option<Document>,
    #[serde(default)]
    pub shipping_address: Option<Document>,
    #[serde(default)]
    pub tax_id: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub cin: Option<String>,
    #[serde(default)]
    pub bank_name: Option<String>,
    #[serde(default)]
    pub bank_account_number: Option<String>,
    #[serde(default)]
    pub bank_ifsc: Option<String>,
    #[serde(default)]
    pub bank_swift: Option<String>,
    #[serde(default)]
    pub social_links: Option<Document>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub default_timezone: Option<String>,
    #[serde(default)]
    pub fiscal_year_start_month: Option<i32>,
    #[serde(default)]
    pub brand_color: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCompanyProfileInput {
    #[serde(default)]
    pub legal_name: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub short_name: Option<String>,
    #[serde(default)]
    pub tagline: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub favicon_url: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub industry_id: Option<String>,
    #[serde(default)]
    pub founded_year: Option<i32>,
    #[serde(default)]
    pub employee_count_band: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub fax: Option<String>,
    #[serde(default)]
    pub registered_address: Option<Document>,
    #[serde(default)]
    pub billing_address: Option<Document>,
    #[serde(default)]
    pub shipping_address: Option<Document>,
    #[serde(default)]
    pub tax_id: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub cin: Option<String>,
    #[serde(default)]
    pub bank_name: Option<String>,
    #[serde(default)]
    pub bank_account_number: Option<String>,
    #[serde(default)]
    pub bank_ifsc: Option<String>,
    #[serde(default)]
    pub bank_swift: Option<String>,
    #[serde(default)]
    pub social_links: Option<Document>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub default_timezone: Option<String>,
    #[serde(default)]
    pub fiscal_year_start_month: Option<i32>,
    #[serde(default)]
    pub brand_color: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCompanyProfileResponse {
    pub id: String,
    pub entity: CrmCompanyProfile,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCompanyProfileResponse {
    pub deleted: bool,
}
