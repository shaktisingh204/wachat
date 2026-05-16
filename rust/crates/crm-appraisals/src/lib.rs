//! # crm-appraisals
//!
//! HTTP surface for Appraisal Review entity. HR performance reviews:
//! employee + reviewer + period + KPI line items + overall rating +
//! comments + lifecycle status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
