//! # crm-tags
//!
//! HTTP surface for the Tag foundational lookup entity. Referenced
//! cross-module (leads, deals, tasks, contacts, etc.) for categorization.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
