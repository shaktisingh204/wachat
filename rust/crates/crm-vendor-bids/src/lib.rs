//! # crm-vendor-bids
//!
//! HTTP surface for the §12.3 Vendor Bid entity. Sister crate to
//! [`crm_purchase_orders`] / [`crm_leads`] in the CRM business-logic
//! tier — same contract:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_extras_types::VendorBid`] from the §12 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/vendor-bids`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_vendor_bids` (matches the §12.3 spec in
//! `crm_function_plan.md`). The `VendorBid` DTO flattens
//! `Identity`/`Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Hard delete
//!
//! `DELETE` removes the row from the collection — mirrors the
//! `crm-leads` crate. Per the CRM ecosystem plan, CRM entities use
//! hard deletes. The list endpoint still filters out `archived = true`
//! rows (legacy data may still carry the flag).
//!
//! ## Lineage (§13.5)
//!
//! Unlike Purchase Orders (which can originate from either an RFQ or a
//! VendorBid), every Vendor Bid has **exactly one** lineage parent kind
//! — the RFQ it was submitted against. There is no `fromKind` switch
//! on the create input: `rfqId` IS the parent, full stop. The handler:
//!
//! 1. Resolves the parent RFQ under the same `userId` scope on create.
//! 2. Seeds `lineage[]` via [`crm_core::build_lineage_from_parent`] so
//!    the bid inherits the RFQ's chain (typically empty, since RFQ is
//!    itself a procurement root).
//! 3. Best-effort back-links onto the parent RFQ's `lineage[]` with
//!    `{ kind: "vendorBid", id }` so the RFQ detail page can list its
//!    bids without a per-page reverse query.
//!
//! ## Award cascade
//!
//! When a PATCH flips `status` to `"awarded"`, the handler best-effort
//! cascades the parent RFQ's status to `"awarded"` as well (a single
//! `update_one` scoped to the same `userId`). The cascade is fire-and-
//! forget — a failure does NOT roll back the bid update; the bid is the
//! authoritative record and an out-of-sync RFQ status will reconcile on
//! next read. Mirrors the pattern in `crm-conversions` where the leaf
//! is the source of truth.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
