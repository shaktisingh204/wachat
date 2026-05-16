//! # crm-assets
//!
//! HTTP surface for the IT/office **Asset** entity (laptops, phones,
//! monitors, badges, keys, vehicles, ...). This is the *operational*
//! asset register — distinct from `crm-fixed-assets`, which is the
//! accounting/depreciation view.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
