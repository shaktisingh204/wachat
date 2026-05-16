//! # crm-documents
//!
//! HTTP surface for Document entity. HR document tracking — contracts,
//! IDs, certifications. Links to employees/candidates/contacts/accounts/
//! vendors with verification + expiry tracking.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
