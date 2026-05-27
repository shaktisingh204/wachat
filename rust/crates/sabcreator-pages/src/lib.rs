//! # sabcreator-pages
//!
//! Page entity for SabCreator. A Page belongs to an App and renders at
//! runtime — kind can be `dashboard`, `list`, `detail`, `form`, `chart`,
//! or `custom`. The `configJson` blob carries the widget tree.
//!
//! Mongo collection: `sabcreator_pages`. Mount under
//! `/v1/sabcreator/pages`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
