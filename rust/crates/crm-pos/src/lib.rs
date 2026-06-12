//! # crm-pos
//!
//! HTTP surface for the point-of-sale terminal backend. Hosts four
//! collections: `crm_pos_sessions` (cash-register open/close),
//! `crm_pos_transactions` (sales lines), `crm_pos_holds` (parked
//! tickets), and `crm_pos_refunds` (refund records).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
