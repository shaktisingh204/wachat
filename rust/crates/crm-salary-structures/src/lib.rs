//! # crm-salary-structures
//!
//! HTTP surface for the Salary Structure entity. The backing
//! `crm_salary_structures` collection holds two shapes (people-suite
//! §2.1.2):
//!
//! - the legacy FLAT [`types::CrmSalaryStructure`] (`employeeId`,
//!   `basic`, `hra`, DA, allowances, PF/ESI/PT) CRUDed by [`handlers`]
//!   on the `/v1/crm/salary-structures` user mount — untouched; and
//! - the **canonical rich** `hrm_payroll_types::SalaryStructure`
//!   (`name`, `effectiveDate`, `components[]`, `applicableTo[]`,
//!   `active`) CRUDed by [`rich`] on the project mount
//!   `/v1/sabcrm/people/salary-structures` — the shape payroll compute
//!   consumes. `projectId` is required per-request there, no `userId`
//!   fallback.

pub mod dto;
pub mod handlers;
pub mod rich;
pub mod router;
pub mod types;

pub use router::{project_router, router};
