//! # crm-debit-notes
//!
//! HTTP surface for the §2.4 Debit Note entity. Vendor-side mirror of the
//! customer-facing Credit Note — issued for returns / discounts /
//! cancellations against a prior bill (or, occasionally, a standalone
//! claim against a purchase order).
//!
//! Conventions match sibling business-logic crates (`crm-leads`,
//! `crm-deals`):
//!
//! - DTOs live in [`dto`] (request shapes only — the response type is
//!   the canonical [`crm_purchases_types::DebitNote`]; we never
//!   redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`]
//!   as their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   [`crm_core::Identity`]).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/debit-notes`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_debit_notes` (matches the §2.4 spec and the
//! existing TS server action `src/app/actions/crm-debit-notes.actions.ts`).
//! The [`DebitNote`](crm_purchases_types::DebitNote) DTO flattens
//! `Identity` / `Audit` / `Assignment` from `crm-core` so the document
//! root carries `_id`, `userId`, `projectId`, `createdAt`, … directly —
//! no migration needed when this crate ships alongside the legacy TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Debit notes feed the vendor ledger and §3.x
//! accounting reports, so we never lose them. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage (G6 pattern — `bill` / `purchaseOrder` parents)
//!
//! On create the body may carry `fromKind` + `fromId`; the only honoured
//! `fromKind` values are `"bill"` and `"purchaseOrder"` — matching the
//! `ALLOWED_PARENT_KINDS` array in the legacy TS action. When both are
//! present the handler fetches the parent (under the same `userId`
//! scope) from the appropriate collection (`crm_expenses` for bills,
//! `crm_purchase_orders` for POs) and seeds the new debit note's
//! `lineage[]` via [`crm_core::build_lineage_from_parent`]. A best-effort
//! back-link onto the parent's own `lineage[]` is also pushed via
//! [`crm_core::append_lineage`]. Failures are non-fatal — the debit note
//! still saves.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
