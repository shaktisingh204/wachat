//! # crm-payroll-runs
//!
//! HTTP surface for the §9.6 Payroll Run entity. Sister business-logic
//! crate to [`crm_leads`](https://docs.rs/crm-leads) and
//! [`crm_employees`](https://docs.rs/crm-employees), following the same
//! conventions:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`hrm_payroll_types::PayrollRun`] from the §9.6 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by the mount's
//!   `crm_core::ScopeMode` — `userId == AuthUser.user_id` on the legacy
//!   mount, a required `projectId` on the SabCRM People suite mount.
//!   Cross-collection reads inside compute use the same resolved scope.
//! - The [`router`] module exposes two state-generic constructors:
//!   [`router::router`] (legacy `userId` scope, mounted under
//!   `/v1/hrm/payroll-runs`) and [`router::project_router`] (SabCRM
//!   People `projectId` scope, mounted under
//!   `/v1/sabcrm/people/payroll-runs`).
//!
//! ## Mongo
//!
//! Backing collection: `crm_payroll_runs`. The PayrollRun DTO flattens
//! `Identity`/`Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, … directly. Read-side
//! lifecycle handlers also touch:
//!
//! - `crm_employees` — to fetch the active employee roster for the
//!   tenant during [`handlers::compute_payroll_run`].
//! - `crm_salary_structures` — to fetch each employee's structure and
//!   resolve its components into earning / deduction lines.
//!
//! ## Hard delete
//!
//! Per the CRM ecosystem plan, CRM entities use hard deletes — `DELETE`
//! removes the row from the collection. The `archived` flag remains on
//! the document model and is still honoured by the list filter, but the
//! DELETE handler now calls `delete_one`. Statutory audits should rely
//! on payslip/challan snapshots rather than the run row itself.
//!
//! ## Lineage
//!
//! Payroll runs are NOT part of the §13.5 sales lineage chain (Lead →
//! Deal → Quotation → Sales Order → Invoice). They are a root HRM
//! workflow node — they reference employees and salary structures by id
//! but do not derive from a sales artefact, so this crate does not
//! accept `fromKind` / `fromId` on create.
//!
//! ## Lifecycle (the three "verb" endpoints)
//!
//! Beyond the standard 5 CRUD endpoints, this crate exposes three
//! lifecycle transitions that mutate `status` + `employees[]` /
//! `approvals[]` / `bankFileId`:
//!
//! | POST verb                              | Effect                                                                    |
//! |----------------------------------------|---------------------------------------------------------------------------|
//! | `/{id}/compute`                        | Resolve roster + structures, populate `employees[]` + `totals`            |
//! | `/{id}/approve`                        | Append an `ApprovalStep`, flip to `approved` once the chain is complete   |
//! | `/{id}/disburse`                       | Stub-generate the bank file, set `bankFileId`, flip to `disbursed`        |
//! | `/{id}/generate-payslips`              | Freeze one rich `hrm_payroll_types::Payslip` per row into `crm_payslips` (approved/disbursed only, idempotent per employee) |
//!
//! See the function-level docs in [`handlers`] for the rules each
//! endpoint enforces (legal source statuses, idempotency, etc.).

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
