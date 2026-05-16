//! # crm-service-contracts
//!
//! HTTP surface for Service Contract / AMC entity. Customer + asset +
//! coverage + frequency + visit schedule + renewal terms + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
