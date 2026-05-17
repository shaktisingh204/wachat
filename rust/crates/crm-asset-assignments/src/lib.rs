//! # crm-asset-assignments
//!
//! HTTP surface for the AssetAssignment entity. Each document records an
//! issue/return event between a physical asset and an employee.
//! Reads/writes `crm_asset_assignments`.
//!
//! Note: `assetId` and `employeeId` are stored as plain strings (not
//! ObjectIds) because assets live in their own Rust crate and use string
//! `_id`s — keeping these as strings avoids cross-collection coupling.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
