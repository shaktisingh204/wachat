//! # crm-payment-receipts
//!
//! HTTP surface for the §1.7 Payment Receipt entity. Mirrors the work
//! done by `src/app/actions/crm-payment-receipts.actions.ts`:
//!
//! - DTOs in [`dto`] (request shapes only — the read/get response shape
//!   is the canonical [`crm_sales_types::PaymentReceipt`] from the §1
//!   sales-types crate; we do not redeclare it here).
//! - Handlers in [`handlers`] use [`sabnode_auth::AuthUser`] as the
//!   tenant principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM tenant root — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   the host `api` crate mounts under `/v1/crm/payment-receipts`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_payment_receipts`. The PaymentReceipt DTO
//! flattens `Identity`/`Audit`/`Assignment` from `crm-core` so the
//! document root carries `_id`, `userId`, `projectId`, `createdAt`, …
//! directly — no migrations needed when this crate ships alongside the
//! existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Receipt provenance is load-bearing for AR / TDS
//! reports, so we never lose it. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage (§13.5)
//!
//! Allowed parent kinds for a receipt: `invoice`, `proforma`. Resolution
//! mirrors the TS `savePaymentReceipt` action's "G4" pattern:
//!
//! 1. If the request explicitly carries `fromKind` + `fromId` AND the
//!    kind is in `ALLOWED_PARENT_KINDS`, that's the primary parent.
//! 2. Otherwise, if `applyTo[]` is non-empty, the **first** invoice in
//!    the allocation list is used as the implicit parent (kind =
//!    `"invoice"`).
//! 3. Otherwise, the receipt is saved without a `lineage[]`.
//!
//! Multi-invoice settlements via `applyTo[]` are NOT cross-linked into
//! `lineage[]` — lineage points at a single primary parent only. The
//! per-invoice allocation table on the receipt is the source of truth
//! for the rest of the chain.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
