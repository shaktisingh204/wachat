//! # crm-form-16
//!
//! HTTP surface for the Form 16 entity. A per-employee, per-financial-
//! year TDS certificate record carrying totals (income/tax) plus a
//! SabFile pointer to the generated PDF. Reads/writes `crm_form_16`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
