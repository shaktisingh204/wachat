//! On-disk shape of a `crm_company_profiles` document.
//!
//! Addresses (`registered_address`, `billing_address`, `shipping_address`) and
//! `social_links` are flexible JSON blobs kept as `bson::Document` so the
//! tenant can store any extra fields without schema churn.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCompanyProfile {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant scope — owning user.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Required. Registered legal name of the company.
    pub legal_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tagline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFile ref (URL or share token resolved by the picker).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub favicon_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub founded_year: Option<i32>,
    /// `"1-10"` | `"11-50"` | `"51-200"` | `"201-1000"` | `"1000+"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_count_band: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fax: Option<String>,

    /// `{ line1, line2, city, state, country, postalCode }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registered_address: Option<Document>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Document>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Document>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cin: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_account_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_ifsc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_swift: Option<String>,

    /// `{ linkedin, twitter, facebook, instagram, youtube, ... }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub social_links: Option<Document>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_timezone: Option<String>,
    /// 1..12 — calendar month index of the fiscal year start.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fiscal_year_start_month: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,

    /// Tenant's primary company profile? At most one should be `true`.
    #[serde(default)]
    pub is_default: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
