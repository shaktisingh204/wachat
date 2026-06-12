//! # crm-payslips
//!
//! HTTP surface for the Payslip entity. The backing `crm_payslips`
//! collection holds two shapes (people-suite WI-9):
//!
//! - the legacy FLAT [`types::CrmPayslip`] written by this crate's
//!   CRUD (basic/hra/allowances/deductions, gross + net, issuance
//!   status), and
//! - the rich, render-ready `hrm_payroll_types::Payslip` written by
//!   `crm-payroll-runs`' `POST /{runId}/generate-payslips` (read-only
//!   here; the only legal mutation is `POST /{payslipId}/mark-sent`).
//!
//! List/get return the unified union (branching on `runId`). Two
//! mounts: [`router::router`] (legacy `userId` scope, under
//! `/v1/crm/payslips`) and [`router::project_router`] (SabCRM People
//! `projectId` scope, under `/v1/sabcrm/people/payslips` — `projectId`
//! is required per-request, no `userId` fallback).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
