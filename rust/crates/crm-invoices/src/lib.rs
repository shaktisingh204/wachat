//! # crm-invoices
//!
//! HTTP surface for the §1.6 Invoice entity. A business-logic crate that
//! sits atop the §1 sales DTO crate (`crm-sales-types`) and follows the
//! J8/J9 template established by `crm-leads` and `crm-deals`:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_sales_types::Invoice`] from the §1.6 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/invoices`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_invoices` (matches the existing TS server
//! action `src/app/actions/crm-invoices.actions.ts`). The `Invoice`
//! struct flattens `Identity`/`Audit`/`Attribution`/`Assignment` from
//! `crm-core` so the document root carries `_id`, `userId`, `projectId`,
//! `createdAt`, … directly — no migrations needed when this crate ships
//! alongside the existing TS code.
//!
//! ## Curated input surface
//!
//! Invoices carry a heavy back-office surface (e-invoice IRP envelope,
//! UPI/QR rendering hints, email/whatsapp send logs, render thumbnails,
//! payment-state mirrors). The wire DTO accepts only the fields a user
//! types into the "Add / Edit Invoice" form: doc number, dates, parties,
//! GST / place-of-supply settings, line items, totals, optional TCS/TDS,
//! payment terms, customer notes, T&C, and recurring config. The
//! deferred fields are populated by domain workflows (the IRP webhook
//! seeds `e_invoice`; the tenant settings seed `bank_details`; the
//! email/whatsapp dispatch seeds the comm logs); accepting them on
//! create/update would let a malicious client backdate or forge an
//! e-invoice.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Invoices are load-bearing for accounting reports
//! and GST returns, so we never lose them. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage
//!
//! On create the body may carry `fromKind` + `fromId` where
//! `fromKind ∈ { quotation, salesOrder, proforma, deal, lead }`. When
//! both are present the handler fetches the parent under the same
//! `userId` scope, builds the new invoice's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`], and best-effort back-links a
//! `{ kind: "invoice", id }` ref onto the parent. Failures are non-fatal
//! — the invoice still saves. Mirrors the §13.5 `saveInvoice` block in
//! the TS action.

pub mod dto;
pub mod handlers;
pub mod stripe;
pub mod router;

pub use router::router;
