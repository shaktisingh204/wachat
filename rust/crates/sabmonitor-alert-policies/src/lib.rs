//! # sabmonitor-alert-policies
//!
//! Alert routing policy — picks which channels (email/sms/webhook/slack/sabwa)
//! receive alerts when a check goes down. Mount under
//! `/v1/sabmonitor/alert-policies`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
