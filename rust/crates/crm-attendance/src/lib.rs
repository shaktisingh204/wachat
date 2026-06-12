//! # crm-attendance
//!
//! HTTP surface for the §9.3 Attendance entity. Sibling business-logic
//! crate to `crm-leads` / `crm-deals` — the conventions are identical:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`hrm_payroll_types::Attendance`] from the §9 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by the mount's
//!   `crm_core::ScopeMode` — `userId == AuthUser.user_id` on the legacy
//!   mounts, a required `projectId` on the SabCRM People suite mount.
//! - The [`router`] module exposes two state-generic constructors:
//!   [`router::router`] (legacy `userId` scope, mounted under
//!   `/v1/hrm/attendance` + the `/v1/crm/attendance` alias) and
//!   [`router::project_router`] (SabCRM People `projectId` scope,
//!   mounted under `/v1/sabcrm/people/attendance`).
//!
//! ## Mongo
//!
//! Backing collection: `crm_attendance` (matches the existing TS server
//! action). The Attendance DTO flattens `Identity`/`Audit` from
//! `crm-core` so the document root carries `_id`, `userId`, `projectId`,
//! `createdAt`, … directly — no migrations needed when this crate ships
//! alongside the legacy TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Attendance is load-bearing for payroll runs and
//! must remain auditable, so we never lose it. The list endpoint
//! excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Attendance has no `lineage[]` chain — every row is a leaf observation
//! anchored to (employeeId, date). No forward-compat lineage hooks are
//! exposed on the create input.
//!
//! ## Punch shorthand
//!
//! Mobile apps don't want to manage full Attendance documents — they
//! just want to stamp a punch on "today's row for the current employee".
//! The [`handlers::punch_in`] / [`handlers::punch_out`] endpoints
//! upsert today's record (creating with sensible defaults if absent)
//! and return the canonical [`hrm_payroll_types::Attendance`] document.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
