//! Meta Business Suite crate — handlers that call into Meta's Graph API
//! for product-catalog browse and mutate operations. Mirrors the legacy
//! `src/app/actions/meta-suite.actions.ts` (which itself thinly wrapped
//! `catalog.actions.ts`) and replaces it with a Rust BFF surface mounted
//! at `/v1/meta/suite`.
//!
//! Surface (registered by `router::router`):
//!   GET    /projects/:id/catalogs                                  → list_catalogs
//!   POST   /projects/:id/catalogs/sync                             → sync_catalogs
//!   GET    /projects/:id/catalogs/:catalogId/products              → list_products
//!   POST   /projects/:id/catalogs/:catalogId/products              → add_product
//!   DELETE /projects/:id/catalogs/products/:productId              → delete_product
//!   POST   /projects/:id/catalogs/products/:productId              → update_product
//!   GET    /projects/:id/catalogs/products/:productId/tagged-media → get_tagged_media
//!   GET    /projects/:id/catalogs/:catalogId/product-sets          → list_product_sets
//!   POST   /projects/:id/catalogs/:catalogId/product-sets          → create_product_set
//!   DELETE /projects/:id/catalogs/product-sets/:productSetId       → delete_product_set

pub mod catalog;
pub mod router;
pub mod state;

pub use router::router;
pub use state::MetaSuiteState;
