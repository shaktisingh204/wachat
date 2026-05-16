//! # crm-automations
//!
//! HTTP surface for the Automation entity. Name + nodes + edges +
//! status. Backed by the `crm_automations` collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
