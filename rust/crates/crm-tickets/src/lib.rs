//! # crm-tickets
//!
//! HTTP surface for the §12.8 Ticket / Help Desk entity. Follows the
//! same conventions established by [`crm_leads`] and [`crm_deals`]:
//!
//! - DTOs live in [`dto`] (request shapes only — the response is the
//!   canonical [`crm_extras_types::Ticket`]; we never redeclare it).
//! - Handlers live in [`handlers`] and authenticate via
//!   [`sabnode_auth::AuthUser`]. Every Mongo query is scoped by
//!   `userId == AuthUser.user_id` (the CRM tenant root — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/tickets`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_tickets`. The Ticket DTO flattens
//! `Identity` / `Audit` / `Assignment` from `crm-core` so the document
//! root carries `_id`, `userId`, `projectId`, `createdAt`, …  directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Tickets are load-bearing for SLA reporting and
//! customer history, so we never lose the document.
//!
//! ## SLA `dueBy`
//!
//! The §12.8 spec computes `dueBy` from the linked [`crm_extras_types::Sla`]
//! at write-time. That evaluator is **deferred** — for now the create
//! / update endpoints accept `dueBy` directly so the legacy TS UI keeps
//! working unchanged. When the SLA matcher lands it will populate
//! `dueBy` server-side and this crate will reject explicit overrides.
//!
//! ## Lineage
//!
//! Tickets are NOT in the §13.5 lineage chain (the chain is
//! Lead → Deal → Quotation → SO → Invoice). No `fromKind` / `fromId`
//! handling here — `parentTicketId` covers ticket-to-ticket hierarchy
//! (split / merge) instead.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
