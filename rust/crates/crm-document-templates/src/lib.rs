//! # crm-document-templates
//!
//! HTTP surface for the DocumentTemplate entity — reusable HR document
//! bodies (contracts, policies, offers) with merge variables. Reads/writes
//! `crm_document_templates`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
