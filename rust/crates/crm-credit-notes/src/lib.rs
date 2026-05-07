//! # crm-credit-notes
//!
//! HTTP surface for the §1.8 Credit Note entity. Business-logic crate
//! atop the `crm-sales-types::CreditNote` DTO. Mirrors
//! `src/app/actions/crm-credit-notes.actions.ts` — read-only research
//! reference; the TS file stays in production until the API host crate
//! routes traffic here.
//!
//! ## Conventions (per the §5.1 / §1.x sibling crates)
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_sales_types::CreditNote`]; we never redeclare
//!   it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id`.
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/credit-notes`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_credit_notes` (matches the existing TS
//! action). The `CreditNote` DTO flattens
//! `Identity`/`Audit`/`Assignment` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly — no
//! migrations needed when this crate ships alongside the existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Credit-note provenance is load-bearing for
//! tax/IRP reporting, so we never lose it. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage (§13.5)
//!
//! On create the body may carry `fromKind: "invoice"` + `fromId`. Per
//! the §13.5 chain a credit note always derives from an invoice, so
//! `invoice` is the **only** allow-listed parent kind here (matches the
//! TS action's `ALLOWED_PARENT_KINDS` literal). When both fields are
//! present the handler fetches the parent invoice (under the same
//! `userId` scope) and seeds the new credit-note's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent invoice. Failures are non-fatal — the
//! credit note still saves.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
