//! # sabops-alerts
//!
//! SabOps alert queue. Alerts are raised by agents or by server-side
//! evaluators (stale heartbeat, low disk, low battery, patch failed,
//! unauthorized software). Admins acknowledge/resolve from the UI.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
