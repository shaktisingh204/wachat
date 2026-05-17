//! # crm-proposals
//!
//! HTTP surface for the Sales Proposal entity. Each row owns a list of
//! body sections, attachments, a status workflow (draft → sent →
//! accepted/rejected/expired), and a denormalised sign count.
//! Reads/writes `crm_proposals`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
