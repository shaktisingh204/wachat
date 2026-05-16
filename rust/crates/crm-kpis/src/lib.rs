//! # crm-kpis
//!
//! HTTP surface for the HR Key Performance Indicator (KPI) entity.
//! Companion to the appraisal entity — tracks the targets that feed
//! into performance reviews (name, target, unit, frequency, owner,
//! department, weight, category, status).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
