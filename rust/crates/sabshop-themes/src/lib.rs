//! # sabshop-themes
//!
//! HTTP surface for SabShop storefront themes. Each theme is a JSON
//! payload of layout/typography/color tokens applied to a storefront.
//! Reads/writes the `sabshop_themes` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
