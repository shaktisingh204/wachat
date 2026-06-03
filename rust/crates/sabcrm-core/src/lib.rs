//! # sabcrm-core
//!
//! Pure-library metadata core for **SabCRM** — a metadata-driven, Twenty-like
//! CRM layered over the existing MongoDB. Ports two TypeScript modules:
//!
//! - [`types`] ← `src/lib/sabcrm/types.ts` — the [`ObjectMetadata`] /
//!   [`FieldMetadata`] type system (objects + fields are *data*, not
//!   hardcoded screens).
//! - [`standard_objects`] ← `src/lib/sabcrm/schema.ts` — the six built-in
//!   objects (companies, people, opportunities, notes, tasks, activities).
//!
//! This crate has no router and no Mongo/axum deps — it is consumed by
//! `sabcrm-records` (and any future SabCRM HTTP crate) for object/field
//! metadata.

pub mod standard_objects;
pub mod types;

pub use standard_objects::*;
pub use types::*;
