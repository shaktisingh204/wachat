//! # crm-reply-templates
//!
//! HTTP surface for Reply Template entity. Canned ticket replies /
//! macro responses with shortcut triggers, variable placeholders,
//! category bucketing, and per-language variants.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
