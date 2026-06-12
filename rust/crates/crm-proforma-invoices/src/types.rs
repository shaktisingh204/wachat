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
