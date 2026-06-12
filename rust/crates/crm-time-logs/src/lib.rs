//! # crm-time-logs
//!
//! HTTP surface for the Time Log entity — time-tracking entries that link
//! an employee (`userLogId`) to a project/task/issue/ticket via either the
//! dedicated `*Id` fields or the polymorphic (`entityKind`, `entityId`)
//! pair. Supports a running clock (no `endedAt` while `status = running`),
//! billable flagging with `hourlyRate`, and an approval workflow
//! (`stopped` → `approved` / `rejected` / `archived`).
//!
//! Mongo collection: `crm_time_logs`. Mount [`router`] under
//! `/v1/crm/time-logs` (legacy, `userId`-scoped) and [`project_router`]
//! under `/v1/sabcrm/people/time-logs`.
//!
//! ## Tenant-scope exception (people-suite WI-13)
//!
//! On this entity `projectId` already means the **WORK project** FK
//! (the CRM project entity the time was logged against) — it is NOT the
//! tenant. The SabCRM tenant scope therefore uses the crate-local field
//! **`tenantProjectId`** (Mongo field, query param, and body key). The
//! project mount filters `{ tenantProjectId: <oid> }` and stamps it on
//! create; requests without `tenantProjectId` are rejected 4xx. Do not
//! "fix" this by filtering `projectId` (wire break + wrong data) or by
//! falling back to `userId` (cross-tenant leak).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
