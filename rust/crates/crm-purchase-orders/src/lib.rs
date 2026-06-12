//! # crm-purchase-orders
//!
//! HTTP surface for the §2.2 Purchase Order entity. Sister crate to
//! [`crm_leads`] / [`crm_deals`] in the CRM business-logic tier — same
//! contract:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_purchases_types::PurchaseOrder`] from the §2
//!   types crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/purchase-orders`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_purchase_orders` (matches the §2.2 spec in
//! `crm_function_plan.md`). The `PurchaseOrder` DTO flattens
//! `Identity`/`Audit`/`Assignment` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. PO provenance is load-bearing for procurement
//! reports and downstream GRN / Bill reconciliation, so we never lose
//! it. The list endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Per §13.5, a Purchase Order's lineage parents are `rfq` and
//! `vendorBid` — the create endpoint accepts an optional `fromKind` +
//! `fromId` pair that, when both are present, fetches the parent (under
//! the same `userId` scope) and seeds the new PO's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the PO.
//!
//! Server-managed fields (`approval`, `linked_grn_ids`,
//! `linked_bill_ids`) are NOT exposed on the create / update DTOs;
//! they're populated by dedicated downstream workflows (approval
//! endpoints, GRN reconciliation, bill issuance) once those land.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
