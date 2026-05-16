//! On-disk shape of a `crm_purchases` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPurchase {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub purchase_number: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_name: Option<String>,

    pub purchase_date: BsonDateTime,

    #[serde(default)]
    pub items: Vec<Document>,

    pub subtotal: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_total: Option<f64>,
    pub total: f64,

    /// `"draft"` | `"received"` | `"paid"` | `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
