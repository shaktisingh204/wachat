//! Request DTOs for the online-store HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::{
    CrmStoreAbandonedCart, CrmStoreOrder, CrmStorePricingRule, CrmStoreProduct,
    CrmStoreShippingZone, CrmStorefront,
};

// ─── Shared inputs ─────────────────────────────────────────────────────────

/// Scope-only query for id-addressed routes (`GET`/`PATCH`/`DELETE`,
/// and the `POST` lifecycle verbs that carry a body). `projectId` is
/// required on SabCRM (project) mounts and ignored on legacy mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomepageBlockInput {
    pub kind: String,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingConditionInput {
    pub kind: String,
    #[serde(default)]
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingAppliesInput {
    pub kind: String,
    #[serde(default)]
    pub refs: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShippingMethodInput {
    pub name: String,
    pub kind: String,
    pub rate: f64,
    #[serde(default)]
    pub free_above_subtotal: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressInput {
    pub line1: String,
    #[serde(default)]
    pub line2: Option<String>,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub country: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderLineItemInput {
    pub product_id: String,
    pub sku: String,
    pub title: String,
    pub quantity: f64,
    pub price: f64,
    #[serde(default)]
    pub total: Option<f64>,
}

// ─── Storefronts ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStorefrontsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStorefrontInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub domain: Option<String>,
    pub currency: String,
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub homepage_blocks: Vec<HomepageBlockInput>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStorefrontInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub homepage_blocks: Option<Vec<HomepageBlockInput>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStorefrontResponse {
    pub id: String,
    pub entity: CrmStorefront,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStorefrontResponse {
    pub deleted: bool,
}

// ─── Store products ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStoreProductsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub category_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStoreProductInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub storefront_id: String,
    pub item_id: String,
    pub sku: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub images: Vec<String>,
    pub price: f64,
    #[serde(default)]
    pub compare_at_price: Option<f64>,
    pub currency: String,
    #[serde(default)]
    pub inventory_tracked: bool,
    #[serde(default)]
    pub stock_status: Option<String>,
    #[serde(default)]
    pub category_ids: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStoreProductInput {
    #[serde(default)]
    pub sku: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub images: Option<Vec<String>>,
    #[serde(default)]
    pub price: Option<f64>,
    #[serde(default)]
    pub compare_at_price: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub inventory_tracked: Option<bool>,
    #[serde(default)]
    pub stock_status: Option<String>,
    #[serde(default)]
    pub category_ids: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStoreProductResponse {
    pub id: String,
    pub entity: CrmStoreProduct,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStoreProductResponse {
    pub deleted: bool,
}

// ─── Pricing rules ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPricingRulesQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePricingRuleInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub storefront_id: String,
    pub name: String,
    pub kind: String,
    #[serde(default)]
    pub conditions: Vec<PricingConditionInput>,
    pub applies: PricingAppliesInput,
    pub value: f64,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub starts_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub ends_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePricingRuleInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub conditions: Option<Vec<PricingConditionInput>>,
    #[serde(default)]
    pub applies: Option<PricingAppliesInput>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub starts_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub ends_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePricingRuleResponse {
    pub id: String,
    pub entity: CrmStorePricingRule,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePricingRuleResponse {
    pub deleted: bool,
}

// ─── Shipping zones ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListShippingZonesQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShippingZoneInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub storefront_id: String,
    pub name: String,
    #[serde(default)]
    pub countries: Vec<String>,
    #[serde(default)]
    pub states: Option<Vec<String>>,
    #[serde(default)]
    pub methods: Vec<ShippingMethodInput>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShippingZoneInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub countries: Option<Vec<String>>,
    #[serde(default)]
    pub states: Option<Vec<String>>,
    #[serde(default)]
    pub methods: Option<Vec<ShippingMethodInput>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShippingZoneResponse {
    pub id: String,
    pub entity: CrmStoreShippingZone,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteShippingZoneResponse {
    pub deleted: bool,
}

// ─── Orders ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListOrdersQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub payment_status: Option<String>,
    #[serde(default)]
    pub fulfillment_status: Option<String>,
    #[serde(default)]
    pub customer_email: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub storefront_id: String,
    pub customer_email: String,
    pub customer_name: String,
    #[serde(default)]
    pub customer_phone: Option<String>,
    pub shipping_address: AddressInput,
    #[serde(default)]
    pub billing_address: Option<AddressInput>,
    pub line_items: Vec<OrderLineItemInput>,
    #[serde(default)]
    pub discount: Option<f64>,
    #[serde(default)]
    pub shipping_total: Option<f64>,
    #[serde(default)]
    pub tax_total: Option<f64>,
    pub currency: String,
    pub payment_method: String,
    #[serde(default)]
    pub payment_ref: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderInput {
    #[serde(default)]
    pub payment_status: Option<String>,
    #[serde(default)]
    pub fulfillment_status: Option<String>,
    #[serde(default)]
    pub payment_ref: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkPaidInput {
    #[serde(default)]
    pub payment_ref: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkFulfilledInput {
    /// `"fulfilled" | "partial"`. Defaults to `"fulfilled"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderResponse {
    pub id: String,
    pub entity: CrmStoreOrder,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOrderResponse {
    pub deleted: bool,
}

// ─── Abandoned carts ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAbandonedCartsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub recovered: Option<bool>,
}

/// Idempotent track / upsert payload keyed by `(storefrontId, customerEmail)`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackAbandonedCartInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub storefront_id: String,
    pub customer_email: String,
    #[serde(default)]
    pub customer_name: Option<String>,
    #[serde(default)]
    pub line_items: Vec<OrderLineItemInput>,
    #[serde(default)]
    pub subtotal: Option<f64>,
    pub currency: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkRecoveredInput {
    pub recovered_order_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackAbandonedCartResponse {
    pub id: String,
    pub entity: CrmStoreAbandonedCart,
    /// True if this call created a new cart row; false on update.
    pub created: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAbandonedCartResponse {
    pub deleted: bool,
}
