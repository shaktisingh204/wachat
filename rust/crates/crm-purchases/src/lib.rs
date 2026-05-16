//! # crm-purchases
//!
//! HTTP surface for the Purchase transaction entity. Vendor + items +
//! totals + status. Distinct from purchase orders (which are pre-committal
//! commitments to buy) — a Purchase here is a recorded transaction.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
