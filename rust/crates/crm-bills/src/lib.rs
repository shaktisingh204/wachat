//! # crm-bills
//!
//! HTTP surface for the §2.3 Bill entity (Purchases & Expenses). Sister
//! crate to [`crm_purchase_orders`] / [`crm_leads`] in the CRM
//! business-logic tier — same contract:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_purchases_types::Bill`] from the §2 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by the
//!   mount's [`crm_core::ScopeMode`]: `userId == AuthUser.user_id` on
//!   the legacy mount, `projectId` on the SabCRM Finance mount.
//! - The [`router`] module exposes the state-generic [`router::router`]
//!   (legacy, mounted under `/v1/crm/bills`) and
//!   [`router::project_router`] (SabCRM Finance, mounted under
//!   `/v1/sabcrm/finance/bills`).
//!
//! ## Mongo
//!
//! Backing collection: `crm_bills` (matches the §2.3 spec in
//! `crm_function_plan.md`). The `Bill` DTO flattens
//! `Identity`/`Audit`/`Assignment` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Bill provenance is load-bearing for AP ageing,
//! TDS reconciliation, and downstream payout matching, so we never lose
//! it. The list endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Per §13.5, a Bill's lineage parents are `purchaseOrder` and `grn` —
//! the create endpoint accepts an optional `fromKind` + `fromId` pair
//! that, when both are present, fetches the parent (under the same
//! `userId` scope) and seeds the new Bill's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the Bill.
//! When the parent is a PO we also stamp `linkedPoId`; when the parent
//! is a GRN we push the parent id onto `linkedGrnIds[]`.
//!
//! Server-managed fields (`amount_paid`, `balance`, `linked_po_id`
//! when not seeded from the parent, `linked_grn_ids` likewise) are NOT
//! exposed on the update DTO — they're populated by dedicated
//! downstream workflows (payout receipts, GRN reconciliation).

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
