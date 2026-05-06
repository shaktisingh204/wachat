//! SabNode Ad Manager BFF.
//!
//! Two responsibilities:
//!
//! 1. **Generic Meta Graph proxy.** Most ad-manager actions are thin
//!    wrappers around `graph.facebook.com/v23.0/{path}` — campaign,
//!    ad-set, ad, creative, audience, pixel, lead-gen, catalog, etc.
//!    Instead of porting every wrapper individually we expose one
//!    handler at `/v1/ad-manager/graph` that takes
//!    `{path, method, params, body, token_kind}` and forwards.
//!
//! 2. **Stateful handlers.** The actions that read or write Mongo —
//!    `users.metaAdAccounts[]`, the `ad_campaigns` collection, plus
//!    multi-step "create campaign + ad-set + creative + ad" flows —
//!    get dedicated routes so the Mongo work and the Graph token
//!    plumbing stay on the Rust side.
//!
//! Token handling: the Next.js session stores Graph tokens directly on
//! the user doc (`users.adManagerAccessToken` for ad-manager work,
//! `users.metaSuiteAccessToken` for FB Pages / Instagram / page-asset
//! reads). The proxy reads the token from Mongo using the AuthUser's
//! `user_id`, so the JWT does NOT need to carry the Graph token —
//! that means tokens never leave the Rust process.

pub mod from_form;
pub mod graph;
pub mod handlers;
pub mod router;
pub mod state;
pub mod store;

pub use router::router;
pub use state::AdManagerState;
