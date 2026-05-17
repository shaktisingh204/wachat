//! # crm-surveys
//!
//! HTTP surface for the HR Survey entity. Tracks survey definitions —
//! title, type, questions, target audience, schedule, and lifecycle
//! status. Reads/writes `crm_surveys`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
