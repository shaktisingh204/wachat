//! # crm-lookup
//!
//! Mongo-backed executor + Axum route handler for the unified lookup
//! API (`crm_function_plan.md` §13.4).
//!
//! ## Layering
//!
//! - [`crm_lookup_types`] — wire-format DTOs (no Mongo dependency).
//! - This crate — `LookupSpec` + per-entity specs + `mongo_lookup::execute`
//!   generic executor + [`handler::lookup_route`] Axum handler.
//! - Future host crate — mounts the route on its router with auth
//!   middleware that produces the [`context::TenantCtx`].
//!
//! ## Wired entities
//!
//! Today the canonical 8 are wired (`client`, `vendor`, `item`,
//! `employee`, `user`, `account`, `warehouse`, `bankAccount`). The
//! remaining `EntityKey` variants return `BadRequest` from
//! [`search::search`] with a clear "not yet implemented" message —
//! frontends can fall back to the existing TS server action for those.

pub mod context;
pub mod entities;
pub mod handler;
pub mod mongo_lookup;
pub mod search;

pub use context::TenantCtx;
pub use handler::{LookupQuery, lookup_route, router};
pub use mongo_lookup::LookupSpec;
pub use search::search;
