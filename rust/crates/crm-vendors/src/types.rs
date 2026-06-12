//! On-disk shape of a `crm_vendors` document.
//!
//! Mirrors the TS `CrmVendor` interface in `src/lib/definitions.ts`. Keep
//! the two in lock-step: field name additions/removals MUST land in both
//! places in the same change.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmVendor {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — stamped on documents created through the
    /// project-scoped `/v1/sabcrm/supply/*` mount; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,
    pub name: String,

    /* ----- identity ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,

    /* ----- contact ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    /* ----- address ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pincode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub street: Option<String>,

    /* ----- tax / commerce ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan_name: Option<String>,
    /// Free-form to accept legacy values (Goods Supplier, Service Provider, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_treatment: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,

    /* ----- banking ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_account_details: Option<BankAccountDetails>,

    /* ----- invoice flags ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_email_in_invoice: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_phone_in_invoice: Option<bool>,

    /* ----- attachments (SabFiles refs per project policy) ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<String>>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

/// Mirrors the TS `BankAccountDetails` (`src/lib/definitions.ts` line 691).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct BankAccountDetails {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_holder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ifsc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_name: Option<String>,
    /// `"current"` | `"savings"` — kept free-form for legacy parity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swift_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iban_code: Option<String>,
}
