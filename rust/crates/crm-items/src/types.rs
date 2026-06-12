//! On-disk shape of a `crm_products` document.
//!
//! Mirrors the TS `CrmProduct` interface in `src/lib/definitions.ts`. Keep
//! the two in lock-step: field name additions/removals MUST land in both
//! places in the same change.
//!
//! Nested shapes (inventory rows, dimensions, weight, variants, batches) are
//! defined as local Rust structs below. The TS surface declares `variants?:
//! any[]` and `batches?: any[]` — we mirror those as `Vec<bson::Bson>` so any
//! shape round-trips faithfully without forcing a premature schema on us.

use bson::{Bson, DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProduct {
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
    pub sku: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit_id: Option<ObjectId>,

    /* ----- pricing ----- */
    pub cost_price: f64,
    pub selling_price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_rate: Option<f64>,
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hsn_sac: Option<String>,
    /// `"goods"` | `"service"`. Free-form to keep parity with TS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_type: Option<String>,

    /* ----- inventory ----- */
    pub is_track_inventory: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub inventory: Vec<ProductInventoryRow>,
    /// Sum of warehouse stocks (mirrors TS `totalStock`).
    #[serde(default)]
    pub total_stock: f64,

    /* ----- physical specs ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<ProductDimensions>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<ProductWeight>,

    /* ----- variants & batches (loose mirror of TS `any[]`) ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variants: Option<Vec<Bson>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batches: Option<Vec<Bson>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_tracking: Option<bool>,

    /* ----- images (URLs / SabFiles refs) ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

/// Per-warehouse stock row in the legacy `inventory` array.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProductInventoryRow {
    pub warehouse_id: ObjectId,
    pub stock: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reorder_point: Option<f64>,
}

/// Physical dimensions in user-chosen units (cm/in/etc — schemaless on the TS
/// side). All fields optional to match the TS shape.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProductDimensions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub length: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breadth: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f64>,
}

/// Gross / net weight pair.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProductWeight {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gross: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub net: Option<f64>,
}
