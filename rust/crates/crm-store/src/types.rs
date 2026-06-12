//! On-disk shapes for the six online-store collections.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

// ─── Shared sub-types ──────────────────────────────────────────────────────

/// A configurable block on a storefront homepage. `kind` is one of
/// `"hero" | "featured" | "categories" | "banner"`; `config` is a free-form
/// JSON payload that the rendering layer interprets per-kind.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HomepageBlock {
    pub kind: String,
    #[serde(default)]
    pub config: serde_json::Value,
}

/// One condition gating a pricing rule. `kind` is one of
/// `"min_subtotal" | "product_ids" | "category_ids" | "tag"`; `value` is the
/// opaque payload the rule engine compares to a cart.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PricingCondition {
    pub kind: String,
    #[serde(default)]
    pub value: serde_json::Value,
}

/// What a pricing rule applies to. `kind` is one of
/// `"all" | "products" | "categories"`. When `kind != "all"`, `refs` carries
/// the relevant ObjectIds.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PricingApplies {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refs: Option<Vec<ObjectId>>,
}

/// One shipping method offered inside a zone. `kind` is one of
/// `"flat" | "weight_based" | "free_above"`. `rate` is the base unit cost
/// (per-shipment for `flat`/`free_above`, per-kg for `weight_based`).
/// `freeAboveSubtotal` only applies when `kind == "free_above"`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShippingMethod {
    pub name: String,
    pub kind: String,
    pub rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub free_above_subtotal: Option<f64>,
}

/// A line on an order or abandoned cart. Snapshot of price + title at the
/// time the cart was assembled, so historical orders stay rendering-stable.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OrderLineItem {
    pub product_id: ObjectId,
    pub sku: String,
    pub title: String,
    pub quantity: f64,
    pub price: f64,
    pub total: f64,
}

/// Postal address.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Address {
    pub line1: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line2: Option<String>,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub country: String,
}

// ─── crm_storefronts ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStorefront {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub name: String,
    /// URL-safe identifier, unique per tenant.
    pub slug: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<String>,
    /// SabFile URL (never a paste-in URL — see SabFiles policy).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub homepage_blocks: Vec<HomepageBlock>,

    /// `"draft" | "published" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_store_products ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStoreProduct {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub storefront_id: ObjectId,
    /// Reference to the master `crm_items` record this projection points at.
    pub item_id: ObjectId,

    pub sku: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFile URLs only.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<String>,

    pub price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compare_at_price: Option<f64>,
    pub currency: String,

    #[serde(default)]
    pub inventory_tracked: bool,
    /// `"in_stock" | "low_stock" | "out_of_stock"`.
    pub stock_status: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub category_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /// `"draft" | "active" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_store_pricing_rules ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStorePricingRule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub storefront_id: ObjectId,
    pub name: String,
    /// `"percent_off" | "fixed_off" | "buy_x_get_y" | "bundle"`.
    pub kind: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conditions: Vec<PricingCondition>,
    pub applies: PricingApplies,
    pub value: f64,
    /// Higher priority rules evaluate first.
    #[serde(default)]
    pub priority: i32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starts_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<BsonDateTime>,

    /// `"active" | "paused" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_store_shipping_zones ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStoreShippingZone {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub storefront_id: ObjectId,
    pub name: String,

    /// ISO-2 country codes.
    #[serde(default)]
    pub countries: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub states: Option<Vec<String>>,

    #[serde(default)]
    pub methods: Vec<ShippingMethod>,

    /// `"active" | "paused" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_store_orders ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStoreOrder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub storefront_id: ObjectId,
    /// Generated `ORD-YYYYMMDD-NNNN`.
    pub order_number: String,

    pub customer_email: String,
    pub customer_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_phone: Option<String>,

    pub shipping_address: Address,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,

    #[serde(default)]
    pub line_items: Vec<OrderLineItem>,

    pub subtotal: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount: Option<f64>,
    pub shipping_total: f64,
    pub tax_total: f64,
    pub total: f64,
    pub currency: String,

    /// `"pending" | "paid" | "failed" | "refunded"`.
    pub payment_status: String,
    pub payment_method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_ref: Option<String>,

    /// `"unfulfilled" | "partial" | "fulfilled" | "cancelled"`.
    pub fulfillment_status: String,

    pub placed_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_invoice_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_store_abandoned_carts ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStoreAbandonedCart {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub storefront_id: ObjectId,
    pub customer_email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,

    #[serde(default)]
    pub line_items: Vec<OrderLineItem>,

    pub subtotal: f64,
    pub currency: String,

    pub last_interaction_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_email_sent_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovered: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovered_order_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
