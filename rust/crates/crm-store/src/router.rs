//! Mountable router for the online-store surface. Mount under
//! `/v1/crm/store` from the host `api` crate:
//!
//! ```ignore
//! use crm_store;
//! .nest("/v1/crm/store", crm_store::router::<AppState>())
//! ```
//!
//! Routes (relative — caller nests under `/v1/crm/store`):
//!
//! ```text
//! GET    /storefronts                          — list_storefronts
//! POST   /storefronts                          — create_storefront
//! GET    /storefronts/{storefrontId}           — get_storefront
//! PATCH  /storefronts/{storefrontId}           — update_storefront
//! DELETE /storefronts/{storefrontId}           — archive_storefront
//!
//! GET    /products                             — list_store_products
//! POST   /products                             — create_store_product
//! GET    /products/{productId}                 — get_store_product
//! PATCH  /products/{productId}                 — update_store_product
//! DELETE /products/{productId}                 — archive_store_product
//!
//! GET    /pricing-rules                        — list_pricing_rules
//! POST   /pricing-rules                        — create_pricing_rule
//! GET    /pricing-rules/{ruleId}               — get_pricing_rule
//! PATCH  /pricing-rules/{ruleId}               — update_pricing_rule
//! DELETE /pricing-rules/{ruleId}               — archive_pricing_rule
//!
//! GET    /shipping-zones                       — list_shipping_zones
//! POST   /shipping-zones                       — create_shipping_zone
//! GET    /shipping-zones/{zoneId}              — get_shipping_zone
//! PATCH  /shipping-zones/{zoneId}              — update_shipping_zone
//! DELETE /shipping-zones/{zoneId}              — archive_shipping_zone
//!
//! GET    /orders                               — list_orders
//! POST   /orders                               — create_order
//! GET    /orders/{orderId}                     — get_order
//! PATCH  /orders/{orderId}                     — update_order
//! DELETE /orders/{orderId}                     — archive_order
//! POST   /orders/{orderId}/mark-paid           — mark_order_paid
//! POST   /orders/{orderId}/mark-fulfilled      — mark_order_fulfilled
//!
//! GET    /abandoned-carts                      — list_abandoned_carts
//! POST   /abandoned-carts/track                — track_abandoned_cart (upsert)
//! GET    /abandoned-carts/{cartId}             — get_abandoned_cart
//! DELETE /abandoned-carts/{cartId}             — delete_abandoned_cart
//! POST   /abandoned-carts/{cartId}/recover     — mark_cart_recovered
//! ```

use std::sync::Arc;

use axum::{
    Extension, Router,
    extract::FromRef,
    routing::{get, post},
};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared store route table (no scope attached yet).
fn store_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Storefronts
        .route(
            "/storefronts",
            get(handlers::list_storefronts).post(handlers::create_storefront),
        )
        .route(
            "/storefronts/{storefrontId}",
            get(handlers::get_storefront)
                .patch(handlers::update_storefront)
                .delete(handlers::archive_storefront),
        )
        // Store products
        .route(
            "/products",
            get(handlers::list_store_products).post(handlers::create_store_product),
        )
        .route(
            "/products/{productId}",
            get(handlers::get_store_product)
                .patch(handlers::update_store_product)
                .delete(handlers::archive_store_product),
        )
        // Pricing rules
        .route(
            "/pricing-rules",
            get(handlers::list_pricing_rules).post(handlers::create_pricing_rule),
        )
        .route(
            "/pricing-rules/{ruleId}",
            get(handlers::get_pricing_rule)
                .patch(handlers::update_pricing_rule)
                .delete(handlers::archive_pricing_rule),
        )
        // Shipping zones
        .route(
            "/shipping-zones",
            get(handlers::list_shipping_zones).post(handlers::create_shipping_zone),
        )
        .route(
            "/shipping-zones/{zoneId}",
            get(handlers::get_shipping_zone)
                .patch(handlers::update_shipping_zone)
                .delete(handlers::archive_shipping_zone),
        )
        // Orders
        .route(
            "/orders",
            get(handlers::list_orders).post(handlers::create_order),
        )
        .route(
            "/orders/{orderId}",
            get(handlers::get_order)
                .patch(handlers::update_order)
                .delete(handlers::archive_order),
        )
        .route(
            "/orders/{orderId}/mark-paid",
            post(handlers::mark_order_paid),
        )
        .route(
            "/orders/{orderId}/mark-fulfilled",
            post(handlers::mark_order_fulfilled),
        )
        // Abandoned carts
        .route("/abandoned-carts", get(handlers::list_abandoned_carts))
        .route(
            "/abandoned-carts/track",
            post(handlers::track_abandoned_cart),
        )
        .route(
            "/abandoned-carts/{cartId}",
            get(handlers::get_abandoned_cart).delete(handlers::delete_abandoned_cart),
        )
        .route(
            "/abandoned-carts/{cartId}/recover",
            post(handlers::mark_cart_recovered),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/store`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    store_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Commerce `projectId`-scoped router — mount under
/// `/v1/sabcrm/commerce/store`. Same handlers, same collections; every
/// request must carry `projectId` (query for id-addressed routes, body
/// for collection `POST`s) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    store_routes().layer(Extension(ScopeMode::Project))
}
