//! # crm-ticket-groups
//!
//! HTTP surface for the TicketGroup entity — hierarchical categorization
//! buckets that support tickets are filed under. Each group is scoped to a
//! tenant (`userId`) and may carry a parent group, a default assignee, and a
//! default SLA, plus presentation (color, icon) and a denormalized ticket
//! counter.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
