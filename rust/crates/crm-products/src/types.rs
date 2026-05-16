//! On-disk shape of a `crm_products` document for the simplified
//! Product entity served by this crate.
//!
//! NOTE: This is intentionally a **fresh** type — not a port of the
//! richer TS `CrmProduct` (which lives in `@/lib/definitions` and is
//! served by the `crm-items` crate). Fields here mirror the simplified
//! BFF contract requested for `/v1/crm/products`:
//!
//! ```text
//! name, sku?, category?, brand?, unit?,
//! buyPrice?, sellPrice, taxRate?, stock?, reorderLevel?,
//! images[], notes?, status ("active" | "inactive" | "archived")
//! ```

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProduct {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,

    /* ----- pricing ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buy_price: Option<f64>,
    pub sell_price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_rate: Option<f64>,

    /* ----- stock (flat — no per-warehouse rows on this shape) ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stock: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reorder_level: Option<f64>,

    /* ----- media + notes ----- */
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"active"` | `"inactive"` | `"archived"`.
    pub status: String,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
