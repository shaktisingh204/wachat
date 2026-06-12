//! # crm-items
//!
//! HTTP surface for the Item/Product entity. Reads/writes the existing TS
//! `CrmProduct` shape against the `crm_products` Mongo collection.
//!
//! Mirrors `src/app/actions/crm-products.actions.ts` — once this crate is
//! mounted, the TS server actions become thin proxies via
//! `src/lib/rust-client/crm-items.ts` (gated on `USE_RUST_CRM=true`).
//!
//! ## Soft delete
//! `DELETE /v1/crm/items/:id` performs a **hard delete** — the TS
//! `CrmProduct` type has no `archived` / `status` field, and the legacy
//! `deleteCrmProduct` server action also hard-deletes. Audit log captures
//! the action so the deletion is still recoverable from the journal.
//!
//! ## Schema note
//! The TS `CrmProduct` is a wide, nested shape (variants, batches,
//! per-warehouse inventory, dimensions, weight). Nested fragments are mirrored
//! as Rust structs in `types.rs` — kept local to this crate per the working
//! convention until a canonical home is chosen.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
