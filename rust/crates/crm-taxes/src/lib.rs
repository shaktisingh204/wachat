//! # crm-taxes
//!
//! HTTP surface for the Tax rate master entity (GST/VAT slabs). Each
//! document holds a display name, optional code, a numeric rate
//! percent, an optional tax type (`"GST"`/`"VAT"`/`"sales"`/`"custom"`),
//! optional component splits (CGST/SGST/IGST), and standard
//! active/archived bookkeeping.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
