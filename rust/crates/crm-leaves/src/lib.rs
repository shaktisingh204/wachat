//! # crm-leaves
//!
//! HTTP surface for §9.4 Leave Management. Combines two related entities
//! into a single business-logic crate so the leave catalog and the
//! per-employee applications ship together (they're always installed
//! and gated as one feature):
//!
//! - **`LeaveType`** — catalog row defining the leave type (CL / SL / EL
//!   / ML / PL / Comp-off / Unpaid / …): paid? flag, accrual rule, max
//!   balance, carry-forward, encashable?, gender restriction, minimum
//!   tenure. Backed by Mongo collection `crm_leave_types`.
//! - **`LeaveApplication`** — per-employee request pointing at a
//!   `LeaveType`, with a from/to range, half-day flag, reason,
//!   attachments, and an ordered approver chain. Backed by Mongo
//!   collection `crm_leave_applications`.
//!
//! ## Conventions
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape for
//!   every read/write endpoint is the canonical `LeaveType` /
//!   `LeaveApplication` from `hrm-payroll-types`; we never redeclare
//!   them here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by the mount's
//!   `crm_core::ScopeMode` — `userId == AuthUser.user_id` on the legacy
//!   mounts, a required `projectId` on the SabCRM People suite mount.
//! - The [`router`] module exposes two state-generic constructors:
//!   [`router::router`] (legacy `userId` scope, mounted under
//!   `/v1/hrm/leaves` + the `/v1/crm/leaves` alias) and
//!   [`router::project_router`] (SabCRM People `projectId` scope,
//!   mounted under `/v1/sabcrm/people/leaves`). Both nest two trees
//!   plus an action endpoint:
//!
//!   ```text
//!   /types/*            — LeaveType CRUD
//!   /applications/*     — LeaveApplication CRUD
//!   /applications/{id}/approve  — approver action
//!   ```
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. The list endpoints exclude `archived = true`
//! rows by default. This applies symmetrically to both resources;
//! deleting a `LeaveType` keeps existing applications honest because
//! they reference it by `leaveTypeId` (the document survives, just
//! hidden from listings).
//!
//! ## No lineage
//!
//! Neither `LeaveType` nor `LeaveApplication` carries a `lineage[]`
//! field — they're root operational records, not part of a
//! quote-to-cash chain. The spec deliberately omits the
//! `crm_core::lineage` plumbing here.
//!
//! ## Approve action
//!
//! `POST /applications/{id}/approve` flips `status` to `Approved`
//! and appends a fresh `ApproverStep` (the caller's user id, current
//! timestamp, optional comment) onto `approverChain`. See
//! [`handlers::approve_leave_application`] for the contract.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
