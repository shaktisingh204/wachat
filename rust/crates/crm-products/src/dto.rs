//! Request DTOs for the simplified Product entity.

use serde::{Deserialize, Serialize};

use crate::types::CrmProduct;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search over `name` and `sku`.
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"inactive"` | `"archived"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// Exact-match filter on the `category` string.
    #[serde(default)]
    pub category: Option<String>,
    /// Exact-match filter on the `brand` string.
    #[serde(default)]
    pub brand: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductInput {
    pub name: String,
    #[serde(default)]
    pub sku: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub brand: Option<String>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub buy_price: Option<f64>,
    /// **Required.** Validated `>= 0`.
    #[serde(default)]
    pub sell_price: Option<f64>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub stock: Option<f64>,
    #[serde(default)]
    pub reorder_level: Option<f64>,
    #[serde(default)]
    pub images: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub sku: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub brand: Option<String>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub buy_price: Option<f64>,
    #[serde(default)]
    pub sell_price: Option<f64>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub stock: Option<f64>,
    #[serde(default)]
    pub reorder_level: Option<f64>,
    #[serde(default)]
    pub images: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductResponse {
    pub id: String,
    pub entity: CrmProduct,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProductResponse {
    pub deleted: bool,
}
