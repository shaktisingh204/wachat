//! # crm-payouts
//!
//! HTTP surface for the §2.5 PayoutReceipt entity — vendor-side mirror of
//! the §1.7 PaymentReceipt. Money flows OUT of our bank to settle one or
//! more bills; a single payout may be split across multiple bills via the
//! `applyTo[]` allocation table, with any excess optionally parked as a
//! vendor advance.
//!
//! Ports `src/app/actions/crm-payouts.actions.ts` and follows the
//! conventions established by sibling crates (`crm-leads`, `crm-deals`):
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_purchases_types::PayoutReceipt`] from the §2
//!   types crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root").
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/payouts`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_payouts` (matches the existing TS server
//! action). The `PayoutReceipt` DTO flattens
//! `Identity`/`Audit`/`Assignment` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly — no
//! migrations needed when this crate ships alongside the existing TS
//! code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Payout history is load-bearing for AP reporting
//! and tax compliance (TDS), so we never lose it. The list endpoint
//! excludes `archived = true` rows by default.
//!
//! ## Lineage seeding (mirrors G7)
//!
//! On create the body may carry `fromKind: "bill"` + `fromId`; when both
//! are present we fetch the parent bill (under the same `userId` scope)
//! and seed the new payout's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`].
//!
//! When `fromId` is absent BUT `applyTo[]` is non-empty, the lineage
//! seeds from the **first** bill in the allocation list — this matches
//! the §G7 fallback behaviour the TS action uses today (multi-bill
//! payouts still produce a single primary parent for the lineage chain).
//!
//! Best-effort — a missing or mis-scoped parent quietly skips the seed
//! and still saves the payout.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
