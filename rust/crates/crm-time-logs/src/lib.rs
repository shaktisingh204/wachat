//! # crm-time-logs
//!
//! HTTP surface for the Time Log entity — time-tracking entries that link
//! an employee (`userLogId`) to a project/task/issue/ticket via either the
//! dedicated `*Id` fields or the polymorphic (`entityKind`, `entityId`)
//! pair. Supports a running clock (no `endedAt` while `status = running`),
//! billable flagging with `hourlyRate`, and an approval workflow
//! (`stopped` → `approved` / `rejected` / `archived`).
//!
//! Mongo collection: `crm_time_logs`. Mount router under
//! `/v1/crm/time-logs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
