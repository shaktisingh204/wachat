//! # crm-professional-tax
//!
//! HTTP surface for the Professional Tax Record entity. State-aware
//! monthly per-employee PT filings. `slabApplied` is computed and stamped
//! by the TS-side action against the `crm_pt_slabs` collection — this
//! BFF accepts a pre-resolved `slab_applied` from the client for now.
//! Reads/writes `crm_professional_tax_records`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
