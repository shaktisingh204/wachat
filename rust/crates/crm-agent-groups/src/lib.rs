//! # crm-agent-groups
//!
//! HTTP surface for the Support Agent Group entity. A group bundles a
//! set of user/agent ids with a manager, assignment strategy
//! (`round_robin`, `load_balanced`, `manual`, `sticky`), business hours
//! reference, and optional shared email — so tickets / chats can be
//! routed to the group rather than a specific agent.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
