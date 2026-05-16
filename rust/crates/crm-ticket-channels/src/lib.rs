//! # crm-ticket-channels
//!
//! HTTP surface for the Ticket Channel entity. Represents ticket
//! source/inbox channels (email, web, phone, whatsapp, chat, social,
//! api) including routing defaults and per-channel settings.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
