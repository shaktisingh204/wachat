//! # sabsense-tax-forms
//!
//! Sabsense - Tax Forms CRUD.
//!
//! Backs the `sabsense_tax_forms` Mongo collection. Mounted under
//! `/v1/sabsense/tax-forms`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
