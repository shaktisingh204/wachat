//! # crm-announcements
//!
//! HTTP surface for the Workplace Announcement entity. Broadcasts with
//! audience targeting, scheduling, priority, acknowledgement tracking,
//! and pin/expiry lifecycle.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
