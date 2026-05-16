//! # crm-ticket-types
//!
//! HTTP surface for the **TicketType** entity (ticket type taxonomy — W8).
//! Each tenant owns a small set of ticket types (e.g. `"Bug"`, `"Feature"`,
//! `"Question"`, `"Incident"`) that classify tickets. Names are unique per
//! tenant (excluding archived) and at most one type may be marked default.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
