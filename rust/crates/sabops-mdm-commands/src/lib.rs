//! # sabops-mdm-commands
//!
//! Issued MDM commands (lock | wipe | locate | install_app | reboot |
//! sync_settings). The agent polls `/api/sabops/agent/commands` to pick up
//! queued commands and acknowledge them.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
