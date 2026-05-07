//! # crm-lookup-types
//!
//! Type contract for the unified lookup API (`crm_function_plan.md`
//! §13.4) — `EntityKey`, `LookupParams`, `LookupResult`, `LookupItem`,
//! `LookupChip`. Pure types — no Mongo execution, no async, no I/O.
//!
//! ## Distinction from `crm-lookup` (planned, not yet shipped)
//!
//! - **`crm-lookup-types`** (this crate) — wire-format DTOs every
//!   client / server party agrees on.
//! - **`crm-lookup`** (future) — Mongo-backed executor + Axum route
//!   handler reusing `sabnode-db::MongoHandle`. Imports this crate.
//!
//! The split lets the picker / quick-add / Cmd-K front ends consume
//! the contract without dragging in a Mongo driver.
//!
//! ## TS parity
//!
//! Mirrors `src/lib/lookup-registry.ts` exactly so an existing TS
//! caller can call a Rust executor (or vice-versa) without renaming
//! fields. CamelCase serde + ISO field names per the project's standard.

pub mod chip;
pub mod entity_key;
pub mod params;
pub mod result;

pub use chip::LookupChip;
pub use entity_key::EntityKey;
pub use params::{LOOKUP_DEFAULT_LIMIT, LOOKUP_MAX_LIMIT, LookupParams, Scope};
pub use result::{LookupItem, LookupResult};
