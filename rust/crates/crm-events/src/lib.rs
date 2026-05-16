//! # crm-events
//!
//! HTTP surface for the Workplace Event entity. Meetings, workshops,
//! holidays, celebrations, training sessions, conferences. Supports
//! all-day flags, online URLs, RSVPs, recurrence (RRULE), and reminders.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
