//! # sabops-patch-policies
//!
//! Patch deployment policies — target endpoints by os/tags/ids, schedule
//! (cron or maintenance window), and action (auto_install|notify|defer).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
