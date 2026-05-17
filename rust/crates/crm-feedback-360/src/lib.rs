//! # crm-feedback-360
//!
//! HTTP surface for the 360° Feedback entity. Tracks reviews of a single
//! employee across one cycle (`period`) gathered from multiple reviewers
//! with structured competency scores. Reads/writes `crm_feedback_360`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
