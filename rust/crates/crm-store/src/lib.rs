//! # crm-store
//!
//! HTTP surface for the online-store backend. Hosts six collections:
//!
//! * `crm_storefronts` — storefront definitions (slug, domain, theme, homepage
//!   blocks, status).
//! * `crm_store_products` — store-published product catalog (a per-storefront
//!   projection of the underlying `crm_items` master).
//! * `crm_store_pricing_rules` — discount, bundle, and BOGO rules.
//! * `crm_store_shipping_zones` — geographic shipping zones with per-zone
//!   methods (flat / weight-based / free-above).
//! * `crm_store_orders` — customer-placed orders with auto-numbered
//!   `ORD-YYYYMMDD-NNNN` IDs and payment + fulfillment state machines.
//! * `crm_store_abandoned_carts` — carts left without checkout, upserted by
//!   `(storefrontId, customerEmail)` for recovery campaigns.
//!
//! Two pure helpers are re-exported for callers that need to evaluate cart
//! state outside the HTTP layer (e.g. background recovery jobs, the public
//! storefront BFF, or future test fixtures):
//!
//! * [`handlers::select_applicable_rules`] — orders + filters pricing rules.
//! * [`handlers::compute_shipping`] — resolves a shipping cost for a zone.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use handlers::{compute_shipping, select_applicable_rules};
pub use router::{project_router, router};
