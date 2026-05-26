//! # sabconnect-groups
//!
//! Employee groups for SabConnect (Zoho Connect style). Each group has
//! a visibility (`open` | `closed` | `secret`), a member list, and an
//! optional cover image sourced from SabFiles.
//!
//! Mount under `/v1/sabconnect/groups`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
