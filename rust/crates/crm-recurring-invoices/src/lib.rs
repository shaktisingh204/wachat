//! # crm-recurring-invoices
//!
//! HTTP surface for the Recurring Invoice entity. Holds a customer +
//! invoice-template pair, a frequency (daily/weekly/monthly/quarterly/
//! yearly), and the next/last run timestamps. Reads/writes
//! `crm_recurring_invoices`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
