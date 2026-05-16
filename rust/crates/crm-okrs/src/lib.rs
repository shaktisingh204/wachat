//! # crm-okrs
//!
//! HTTP surface for the OKR (Objectives & Key Results) entity. Objective
//! + description + period + owner + team/department + parent hierarchy
//! + weighted key results + progress + confidence + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
