//! # crm-ticket-tags
//!
//! HTTP surface for the TicketTag entity — classification labels applied to
//! support tickets. Each tag is scoped to a tenant (`userId`) and carries
//! presentation (color, icon) plus a denormalized usage counter.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
