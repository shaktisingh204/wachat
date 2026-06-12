//! # crm-grns
//!
//! HTTP surface for the §12.4 GRN (Goods Receipt Note) entity. Sister
//! crate to `crm-purchase-orders` — a GRN is the receipt-side document
//! posted when stock physically lands at a warehouse, optionally
//! linked back to the originating PO.
//!
//! Conventions follow the `crm-leads` / `crm-purchase-orders` template:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_extras_types::Grn`] from the §12 types crate;
//!   we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM tenant root — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/grns`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_grns`. The Grn DTO flattens
//! `Identity`/`Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Receipts are load-bearing for inventory ledger
//! reconciliation, so we never lose them. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage (§13.5)
//!
//! When the create body carries `po_id`, the handler fetches the parent
//! PO from `crm_purchase_orders` (under the same `userId` scope) and
//! seeds the new GRN's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`] with parent kind
//! `"purchaseOrder"`. Best-effort — a missing or mis-scoped parent
//! quietly skips the seed and still saves the GRN.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
