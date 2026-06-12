//! Request DTOs — what callers send IN.
//!
//! Responses use the full [`crate::types::CrmProduct`].

use serde::{Deserialize, Serialize};

use crate::types::{ProductDimensions, ProductInventoryRow, ProductWeight};

/// `GET /v1/crm/items?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 0-indexed page (matches the `makeCrmClient` factory shape).
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to `crm_common::DEFAULT_LIMIT`, clamped to `MAX_LIMIT`.
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text. Searched across `name`, `sku`, `barcode`, `hsn`/`hsnSac`.
    #[serde(default)]
    pub q: Option<String>,
    /// SabCRM suite scope — required on `/v1/sabcrm/supply/*` mounts,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Query for single-document routes (`GET`/`PATCH`/`DELETE /{id}`) —
/// carries the SabCRM `projectId` on project-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/items` body. Mirrors the TS `CrmProduct` create surface.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {
    pub name: String,
    pub sku: String,

    /// SabCRM suite scope — required on project-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,

    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub unit_id: Option<String>,

    /* pricing */
    #[serde(default)]
    pub cost_price: Option<f64>,
    #[serde(default)]
    pub selling_price: Option<f64>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub hsn_sac: Option<String>,
    #[serde(default)]
    pub item_type: Option<String>,

    /* inventory */
    #[serde(default)]
    pub is_track_inventory: Option<bool>,
    #[serde(default)]
    pub inventory: Option<Vec<ProductInventoryRow>>,
    #[serde(default)]
    pub total_stock: Option<f64>,

    /* physical */
    #[serde(default)]
    pub dimensions: Option<ProductDimensions>,
    #[serde(default)]
    pub weight: Option<ProductWeight>,

    /* variants / batches — opaque pass-through */
    #[serde(default)]
    pub variants: Option<Vec<bson::Bson>>,
    #[serde(default)]
    pub batches: Option<Vec<bson::Bson>>,
    #[serde(default)]
    pub batch_tracking: Option<bool>,

    /* images */
    #[serde(default)]
    pub images: Option<Vec<String>>,
}

/// `PATCH /v1/crm/items/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub sku: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub brand_id: Option<String>,
    #[serde(default)]
    pub unit_id: Option<String>,

    #[serde(default)]
    pub cost_price: Option<f64>,
    #[serde(default)]
    pub selling_price: Option<f64>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub hsn_sac: Option<String>,
    #[serde(default)]
    pub item_type: Option<String>,

    #[serde(default)]
    pub is_track_inventory: Option<bool>,
    #[serde(default)]
    pub inventory: Option<Vec<ProductInventoryRow>>,
    #[serde(default)]
    pub total_stock: Option<f64>,

    #[serde(default)]
    pub dimensions: Option<ProductDimensions>,
    #[serde(default)]
    pub weight: Option<ProductWeight>,

    #[serde(default)]
    pub variants: Option<Vec<bson::Bson>>,
    #[serde(default)]
    pub batches: Option<Vec<bson::Bson>>,
    #[serde(default)]
    pub batch_tracking: Option<bool>,

    #[serde(default)]
    pub images: Option<Vec<String>>,
}

/// `POST /v1/crm/items` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemResponse {
    pub id: String,
    /// Echo of the inserted doc (with `_id` filled in).
    pub entity: crate::types::CrmProduct,
}

/// `DELETE /v1/crm/items/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemResponse {
    pub deleted: bool,
}
