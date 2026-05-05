//! # wachat-facebook-business
//!
//! Business-Manager admin + Commerce-Manager order operations for the
//! SabNode Rust BFF. Mirrors the **BUSINESS MANAGER UTILITIES** and
//! **COMMERCE — ORDER MANAGEMENT** slices of
//! `src/app/actions/facebook.actions.ts` 1:1 — every function in this
//! crate corresponds to one `export async function` in that file.
//!
//! Mount under `/v1/facebook/business` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/business", wachat_facebook_business::router::<AppState>())
//! ```
//!
//! ## Surface
//!
//! ```text
//! GET    /projects/:id                                business details
//! GET    /projects/:id/owned-pages                    owned pages
//! GET    /projects/:id/owned-ad-accounts              owned ad accounts
//! GET    /projects/:id/owned-instagram                owned IG accounts
//! GET    /projects/:id/system-users                   system users
//! GET    /projects/:id/users                          business users
//! GET    /projects/:id/pending-users                  pending users
//! POST   /projects/:id/users/invite                   invite business user
//! GET    /projects/:id/commerce/settings              commerce-merchant settings
//! GET    /projects/:id/commerce/orders                facebook orders list
//! POST   /projects/:id/commerce/orders/:oid/fulfill   fulfill order
//! POST   /projects/:id/commerce/orders/:oid/cancel    cancel order
//! POST   /projects/:id/commerce/orders/:oid/refund    refund order
//! ```
//!
//! Most of these are pure forwarding to `graph.facebook.com/v23.0/*`. The
//! crate uses [`wachat_meta_client::MetaClient`] for transport (retries,
//! error envelope parsing, connection pool) and only touches Mongo to
//! resolve tenancy + read `facebookPageId` for the commerce flow.

pub mod business;
pub mod commerce;
pub mod router;
pub mod state;

pub use router::router;
pub use state::WachatFacebookBusinessState;
