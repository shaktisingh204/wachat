//! On-disk shape of a `crm_taxes` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTax {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name, e.g. `"GST 18%"` or `"VAT Standard"`.
    pub name: String,

    /// Stable short code, e.g. `"GST_5"`, `"GST_18"`, `"VAT_STD"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// Effective tax rate as a percentage (e.g. `18.0`).
    pub rate: f64,

    /// `"GST"` | `"VAT"` | `"sales"` | `"custom"`.
    #[serde(rename = "taxType", default, skip_serializing_if = "Option::is_none")]
    pub tax_type: Option<String>,

    /// Component splits for composite taxes (CGST/SGST/IGST). Stored
    /// as free-form documents so callers can attach arbitrary metadata
    /// per component (name, rate, code, etc.) without schema churn.
    #[serde(default)]
    pub components: Vec<Document>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default)]
    pub is_default: bool,

    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
