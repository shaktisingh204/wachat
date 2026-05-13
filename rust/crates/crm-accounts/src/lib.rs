//! # crm-accounts
//!
//! HTTP surface for the Account/Client entity (`docs/ecosystem/CRM_PLAN.md`
//! §6.2 — first dependency-priority entity in Phase B). Reads/writes the
//! existing TS `CrmAccount` shape against the `crm_accounts` Mongo
//! collection.
//!
//! Mirrors `src/app/actions/crm-accounts.actions.ts` — once this crate is
//! mounted, the TS server actions will become thin proxies via
//! `src/lib/rust-client/crm-accounts.ts` + the `makeCrmActions` factory.
//!
//! ## Soft delete
//! `DELETE /v1/crm/accounts/:id` sets `status: "archived"` rather than
//! removing the row — matches the existing TS `archiveCrmAccount`. List
//! defaults exclude archived. A future hard-delete handler can be added.
//!
//! ## Schema note
//! The canonical §1.1 Rust DTO lives in `crm-sales-types::Client` with the
//! full identity/audit/lifecycle fragment composition. This crate
//! intentionally targets the **legacy** TS shape so the existing UI keeps
//! working unchanged. A future migration can lift `crm_accounts` docs into
//! the heavier shape.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
