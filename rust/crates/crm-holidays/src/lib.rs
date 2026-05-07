//! # crm-holidays
//!
//! HTTP surface for the §9.5 Holiday entity. Small HR reference crate
//! used by the CRM module to expose project-wide holiday calendars
//! (national / regional / religious / optional / restricted days) for
//! attendance + leave calculations downstream.
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`hrm_payroll_types::Holiday`] from the §9.5 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/holidays`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_holidays`. The Holiday DTO flattens
//! `Identity` / `Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Holiday history is referenced by attendance and
//! payroll runs, so it must remain queryable post-delete. The list
//! endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Holidays are calendar leaves — there is no parent-child chain. No
//! `lineage[]` field on this entity, no lineage hooks on create.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
