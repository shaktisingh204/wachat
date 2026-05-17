//! # crm-hire
//!
//! HTTP surface for the Hire Requisition entity (also known as purchase
//! leads). A hire requisition captures the intent to source a product or
//! vendor before the work is formalised into `crm_jobs`. Reads/writes the
//! `crm_purchase_leads` collection so the persisted shape stays compatible
//! with existing TS callers in `crm-hire.actions.ts`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
