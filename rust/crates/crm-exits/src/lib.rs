//! # crm-exits
//!
//! HTTP surface for Exit/Offboarding case entity. Employee + type +
//! FNF/NOC/asset-return/KT status + notice/last day + interview notes.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
