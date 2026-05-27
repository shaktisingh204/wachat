//! # sabbackstage-ticket-types
//!
//! HTTP surface for the SabBackstage Ticket Type entity. A ticket
//! type is a buyable tier on a public ticketed event (e.g. "Early
//! Bird", "VIP", "Standard") bound to a row in the existing
//! `crm_events` collection. Each row carries name + description +
//! price (in minor units) + currency + capacity + soldCount +
//! optional sales window + status (`draft|live|paused|soldout`).
//!
//! Backs the `sabbackstage_ticket_types` Mongo collection. Admin
//! CRUD mounts under `/v1/sabbackstage/ticket-types`. The public
//! list-by-event endpoint `/public/by-event/:eventId` is intentionally
//! unauthenticated — the public event-page renderer calls it.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
