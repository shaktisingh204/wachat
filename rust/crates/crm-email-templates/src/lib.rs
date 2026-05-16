//! # crm-email-templates
//!
//! HTTP surface for Email Template entity. Name + subject +
//! body (html/text) + variables + category + active flag.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
