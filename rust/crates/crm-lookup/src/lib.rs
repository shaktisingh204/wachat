//! # crm-lookup
//!
//! Mongo-backed executor + Axum route handler for the unified lookup
//! API (`crm_function_plan.md` §13.4) plus the §13.9 Redis-backed
//! recents cache.
//!
//! ## Layering
//!
//! - [`crm_lookup_types`] — wire-format DTOs (no Mongo / Redis dep).
//! - This crate — `LookupSpec` + per-entity specs + `mongo_lookup::execute`
//!   generic executor + [`embedded_lookup`] + [`static_lookup`]
//!   alternate executors + [`recents`] Redis LRU + [`handler::lookup_route`]
//!   Axum handler.
//! - Future host crate — mounts the route on its router with auth
//!   middleware that produces the [`context::TenantCtx`].
//!
//! ## Wired entities (all 42 `EntityKey` variants)
//!
//! - Mongo collection — 37 entities including `Pincode` (cross-tenant).
//! - Embedded sub-doc — Pipeline, Stage (`users.crmPipelines[]`).
//! - Static reference — Currency, Country, State.

pub mod context;
pub mod embedded_lookup;
pub mod entities;
pub mod handler;
pub mod indexes;
pub mod mongo_lookup;
pub mod recents;
pub mod search;
pub mod static_lookup;

pub use context::TenantCtx;
pub use handler::{LookupQuery, lookup_route, router};
pub use mongo_lookup::LookupSpec;
pub use search::search;
