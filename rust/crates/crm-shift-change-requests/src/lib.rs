//! # crm-shift-change-requests
//!
//! HTTP surface for the Shift Change Request entity. An employee asks to
//! swap their current shift for a different shift on a given effective
//! date; a manager/HR approver can approve or reject the request.
//! Reads/writes `crm_shift_change_requests`.
//!
//! NOTE: the on-disk shape uses `snake_case` field names (matching the
//! existing TS action shape), so handlers preserve that convention.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
