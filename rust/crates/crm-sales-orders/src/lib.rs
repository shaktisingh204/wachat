//! # crm-sales-orders
//!
//! HTTP surface for the §1.4 Sales Order entity. Built on the same
//! conventions as sibling business-logic crates (`crm-leads`,
//! `crm-deals`):
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_sales_types::SalesOrder`] from the §1 sales
//!   types crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/sales-orders`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_sales_orders` (matches the existing TS
//! server action `src/app/actions/crm-sales-orders.actions.ts`). The
//! `SalesOrder` DTO flattens `Identity`/`Audit`/`Attribution`/
//! `Assignment` from `crm-core` so the document root carries `_id`,
//! `userId`, `projectId`, `createdAt`, … directly — no migrations
//! needed when this crate ships alongside the existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Sales-order provenance feeds delivery / invoice
//! lineage downstream, so we never lose it. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage
//!
//! On create the body may carry `fromKind` + `fromId` where `fromKind`
//! is one of `quotation` | `lead` | `deal` | `proforma` (mirrors the
//! TS `saveSalesOrder` action's `ALLOWED_PARENT_KINDS`). When both are
//! present the handler fetches the parent (under the same `userId`
//! scope) and seeds the new SO's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent doc. Failures are non-fatal — the
//! sales order still saves.
//!
//! ## Server-managed fields
//!
//! `linkedDeliveryIds` and `linkedInvoiceIds` are deliberately NOT
//! exposed on `Create`/`Update` inputs — they are mutated by the
//! Delivery-Challan-from-SO and Invoice-from-SO converters (which run
//! in their own crates). Allowing direct edits here would let a
//! caller create a fictitious link.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
