//! # crm-portal-users
//!
//! HTTP surface for the Portal User entity. Customer-facing portal logins
//! (name + email + linked contact + role + status). Password / hash / token
//! material is **not** modelled here — it lives behind a separate auth path.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
