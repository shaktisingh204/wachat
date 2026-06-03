//! §2.1 Vendors & Suppliers.
//!
//! Mongo collection: `crm_vendors`. The TS spec says "same field set as
//! Clients + vendor extras" — we duplicate the party-profile fields
//! rather than composing `Client` because:
//!   1. `ClientType` (prospect/customer) doesn't apply to vendors.
//!   2. The collection is distinct, so the doc shape stays separately
//!      versionable.
//!   3. Future cleanup may extract a shared `PartyProfile` fragment;
//!      that refactor is cheap once a third entity (employee?) needs
//!      the same shape.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, CustomFields, Identity, Note, Tags};
use crm_sales_types::{Address, ContactBook, ContactChannel, OpeningBalance, TaxPreference};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VendorType {
    #[default]
    Goods,
    Services,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vendor {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- entity discriminator + name --------------------------- */
    #[serde(default)]
    pub vendor_type: VendorType,

    pub first_name: String,
    pub last_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salutation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,

    /* ----- statutory ids ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aadhaar_masked: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cin: Option<String>,

    /* ----- profile ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub designation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    /* ----- contact book ------------------------------------------ */
    pub contact: ContactBook,

    /* ----- billing / payment prefs ------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_limit: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_period_days: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    /* ----- tax --------------------------------------------------- */
    #[serde(default)]
    pub tax_preference: TaxPreference,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_registration_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    /* ----- addresses --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shipping_addresses: Vec<Address>,

    /* ----- defaults ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_warehouse_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_discount_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_tax_rate_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<OpeningBalance>,

    /* ----- soft profile ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_file_id: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub dob: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub anniversary: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferred_contact_channel: Option<ContactChannel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferred_language: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    /* ----- §2.1 vendor-specific extras --------------------------- */
    /// MSME registration flag. Drives the 45-day payment-rule reminder
    /// ladder.
    #[serde(default, skip_serializing_if = "is_false")]
    pub msme_registered: bool,
    /// MSME category — "micro" / "small" / "medium". Free-form because
    /// thresholds change.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msme_category: Option<String>,
    /// Udyam Registration Number.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msme_number: Option<String>,
    /// Internal 1-5 quality rating used by Sourcing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_rating: Option<u8>,
    /// FK into `crm_chart_of_accounts` — purchase ledger this vendor's
    /// bills post to by default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_purchase_ledger_id: Option<ObjectId>,
    /// FK into `crm_chart_of_accounts` — expense ledger for non-stock
    /// bills (services, utilities).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_expense_ledger_id: Option<ObjectId>,
    /// TDS section under the Income-Tax Act ("194C", "194J", "194Q",
    /// "194I", …). Stored as the printed code.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_section: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_rate: Option<f32>,
    /// Default lead time in days from PO → goods receipt.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_time_days: Option<u32>,
    /// Minimum order quantity the vendor accepts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_order_qty: Option<f64>,
    /// Email used for the vendor portal invite (may differ from the
    /// primary contact email).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_portal_email: Option<String>,

    /* ----- assignment + bag fragments --------------------------- */
    #[serde(flatten)]
    pub assignment: Assignment,
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
    #[serde(default, skip_serializing_if = "CustomFields::is_empty")]
    pub custom_fields: CustomFields,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<Note>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
