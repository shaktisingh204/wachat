//! On-disk shape of a `crm_proforma_invoices` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProformaLineItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_pct: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProformaInvoice {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM workspace scope; absent on legacy (`userId`-scoped) docs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub proforma_number: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<ObjectId>,
    pub proforma_date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_till_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /* ----- canonical advance fields (finance-rollout gap G3) ------ */
    /* Ported from `crm_sales_types::ProformaInvoice` so the project   */
    /* mount can serve advance-payment UX. All optional + defaulted so */
    /* legacy documents (which never carried them) deserialize as-is.  */
    /// Linked Sales Order — populated when the proforma is generated as
    /// an advance-payment request against a confirmed SO.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_so_id: Option<ObjectId>,
    /// Advance %. When populated, drives the ask amount; the absolute
    /// `advance_amount` is stored alongside so PDFs render the exact
    /// figure.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advance_pct: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advance_amount: Option<f64>,
    /// Date the advance payment is due.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_due_date: Option<BsonDateTime>,
    /// Expected delivery date communicated to the customer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_delivery: Option<BsonDateTime>,

    #[serde(default)]
    pub line_items: Vec<ProformaLineItem>,

    pub subtotal: f64,
    pub total: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_total: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount_total: Option<f64>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub terms_and_conditions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"Draft"` | `"Issued"` | `"Converted"` | `"Cancelled"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
}
