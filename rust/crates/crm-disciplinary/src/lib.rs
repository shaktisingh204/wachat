//! # crm-disciplinary
//!
//! HTTP surface for Disciplinary Case entity. Employee + caseType +
//! severity + incident date + evidence + hearings + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
