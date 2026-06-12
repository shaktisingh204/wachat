//! # crm-expense-categories
//!
//! HTTP surface for the ExpenseCategory entity (W11) — classification master
//! for expense lines. Each category is scoped to a tenant (`userId` on the
//! legacy mount, `projectId` on the SabCRM project mount — finance-rollout
//! gap G5), carries optional nesting (`parentId`), a default GL account, tax
//! rate, billable / reimbursable flags, per-expense ceilings, receipt
//! thresholds, and visual presentation (color, icon).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
