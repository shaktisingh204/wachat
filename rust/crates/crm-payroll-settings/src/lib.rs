//! # crm-payroll-settings
//!
//! HTTP surface for the **PayrollSetting** entity — a per-tenant
//! configuration document holding pay cycle, PF/ESI rates, tax slabs,
//! default currency, statutory toggles, and approval routing.
//!
//! Two mounts (see [`router`]):
//!
//! - [`router::router`] — legacy `userId` scope, under
//!   `/v1/crm/payroll-settings` (list/create CRUD, behaviour frozen).
//! - [`router::project_router`] — SabCRM People `projectId` scope,
//!   under `/v1/sabcrm/people/payroll-settings`. Singleton-per-scope
//!   (people-suite WI-14): `GET /` returns the scope's single document,
//!   `PUT /` upserts. Every request must carry `projectId` or it is
//!   rejected 4xx — there is no `userId` fallback.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
