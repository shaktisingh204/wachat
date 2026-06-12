//! # crm-employees
//!
//! HTTP surface for the §9.1 Employee entity. Sister business-logic
//! crate to [`crm_leads`](https://docs.rs/crm-leads), following the same
//! conventions:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`hrm_payroll_types::Employee`] from the §9.1 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by the mount's
//!   `crm_core::ScopeMode` — `userId == AuthUser.user_id` on the legacy
//!   mounts, a required `projectId` on the SabCRM People suite mount.
//! - The [`router`] module exposes two state-generic constructors:
//!   [`router::router`] (legacy `userId` scope, mounted under
//!   `/v1/hrm/employees` + the `/v1/crm/employees` alias) and
//!   [`router::project_router`] (SabCRM People `projectId` scope,
//!   mounted under `/v1/sabcrm/people/employees`).
//!
//! ## Mongo
//!
//! Backing collection: `crm_employees` (matches the existing TS server
//! action). The Employee DTO flattens `Identity`/`Audit`/`Assignment`
//! from `crm-core` AND the §9.1 sub-section fragments
//! (`PersonalProfile`/`EmploymentProfile`/`EmployeeDocuments`) so the
//! document root carries `_id`, `userId`, `firstName`, `joiningDate`,
//! `departmentId`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Employee history is load-bearing for payroll
//! audits, statutory compliance, and tenure calculations, so we never
//! lose it. The list endpoint excludes `archived = true` rows by
//! default.
//!
//! ## Lineage
//!
//! Employees are NOT part of the §13.5 lineage chain (Lead → Deal →
//! Quotation → Sales Order → Invoice). They are a root HRM node and
//! never derive from a sales artefact, so this crate does not accept
//! `fromKind` / `fromId` on create — unlike the `crm-leads` template.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
