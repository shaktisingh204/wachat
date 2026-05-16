//! # crm-settings
//!
//! HTTP surface for per-tenant key/value CRM settings. Each row stores a
//! `key` unique within the owner's scope plus a free-form `value` document,
//! optional `category` and `description`, and `is_secret` / `is_active`
//! flags.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
