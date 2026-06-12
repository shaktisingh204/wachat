//! # crm-vendors
//!
//! HTTP surface for the Vendor entity. Reads/writes the existing TS
//! `CrmVendor` shape against the `crm_vendors` Mongo collection.
//!
//! Mirrors `src/app/actions/crm-vendors.actions.ts` — once this crate is
//! mounted, the TS server actions become thin proxies via
//! `src/lib/rust-client/crm-vendors.ts` (gated by `USE_RUST_CRM`).
//!
//! ## Delete semantics
//! Unlike `crm-accounts`, the legacy `CrmVendor` TS type has **no `status`
//! field**, so `DELETE /v1/crm/vendors/:id` is a **hard delete** — matches
//! the existing TS `deleteCrmVendor` behavior.
//!
//! ## Schema note
//! Field set matches `src/lib/definitions.ts::CrmVendor` exactly. Keep both
//! sides in lock-step on any addition/removal.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
