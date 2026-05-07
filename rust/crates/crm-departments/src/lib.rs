//! # crm-departments
//!
//! HTTP surface for the §9.2 Department + Designation HRM reference
//! entities. Sister business-logic crate to [`crm_employees`] and
//! [`crm_leads`], following the same conventions:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shapes
//!   are the canonical [`hrm_payroll_types::Department`] and
//!   [`hrm_payroll_types::Designation`] from the §9.2 types crate; we
//!   never redeclare them here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm` (the router itself
//!   contributes both `/departments/*` and `/designations/*` subtrees).
//!
//! ## Dual-resource layout
//!
//! Unlike most §9.x crates which back a single collection, §9.2 covers
//! TWO closely-related but distinct HRM lookup tables. They share an
//! ownership/audit model and a near-identical CRUD shape, but they live
//! in separate Mongo collections (`crm_departments` and
//! `crm_designations`) and have their own field sets:
//!
//! - **Department** — org-chart node (Engineering → Platform → Infra),
//!   carries `parentDepartmentId`, `headId`, `costCenter`.
//! - **Designation** — job title / role band (Senior Engineer L4),
//!   carries `departmentId`, `level`, `grade`, `minCtc`, `maxCtc`,
//!   `reportsToDesignationId`.
//!
//! Bundling both into a single crate keeps the §9.2 surface area
//! cohesive (they're nearly always edited together in the HR setup UI)
//! while keeping the collection boundaries — and therefore index /
//! query plans — cleanly separated.
//!
//! ## Mongo
//!
//! Backing collections: `crm_departments` and `crm_designations`. Both
//! DTOs flatten `Identity`/`Audit` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly — no
//! migrations needed when this crate ships alongside the existing TS
//! code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Department / Designation references are
//! load-bearing for payroll history (a payslip from 2024 must still
//! resolve its old designation even after a re-org), so we never lose
//! them. The list endpoints exclude `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Department and Designation are NOT part of the §13.5 lineage chain
//! (Lead → Deal → Quotation → Sales Order → Invoice). They are root
//! HRM lookup nodes and never derive from a sales artefact, so this
//! crate does not accept `fromKind` / `fromId` on create — unlike the
//! `crm-leads` template.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
