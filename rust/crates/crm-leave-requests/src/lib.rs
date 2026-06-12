//! # crm-leave-requests
//!
//! HTTP surface for the **LeaveRequest** entity — per-employee leave
//! applications stored in the legacy `crm_leave_requests` collection.
//!
//! This is **distinct** from the `crm-leaves` crate, which manages the
//! leave-type catalog (`crm_leave_types`) and the newer
//! `crm_leave_applications` records. This crate owns the legacy
//! request/application records driven by
//! `getCrmLeaveRequests` / `applyForCrmLeave` / `approveOrRejectLeave`
//! in `crm-hr.actions.ts`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
