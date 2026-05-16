//! # crm-policies
//!
//! HTTP surface for the HR Policy entity. Versioned policy documents
//! (leave, travel, code of conduct, IT security, HR, finance, …) with
//! optional inline markdown content or SabFile attachment, effective/
//! review/expiry dates, ownership, department scoping, acknowledgement
//! tracking, status workflow, and tagging.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
