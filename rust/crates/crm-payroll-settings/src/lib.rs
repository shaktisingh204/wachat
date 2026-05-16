//! # crm-payroll-settings
//!
//! HTTP surface for the **PayrollSetting** entity — a per-tenant
//! configuration document holding pay cycle, PF/ESI rates, tax slabs,
//! default currency, statutory toggles, and approval routing.
//!
//! Mount via [`router::router`] under `/v1/crm/payroll-settings`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
