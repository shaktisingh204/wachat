//! # hrm-payroll-types
//!
//! DTOs for HRM Payroll (`crm_function_plan.md` §9): employees,
//! departments + designations, attendance, leave, holidays, payroll
//! runs, salary structures, payslips, statutory compliance (PF/ESI/PT/
//! TDS/Form 16), performance, and HRM settings. §9.11 reports live in
//! the unified `crm-reports-types` crate.

pub mod attendance;
pub mod compliance;
pub mod department;
pub mod employee;
pub mod holiday;
pub mod leave;
pub mod payroll_run;
pub mod payslip;
pub mod performance;
pub mod salary_structure;
pub mod settings;

// Explicit re-exports — `EarningLine` / `DeductionLine` /
// `ReimbursementLine` are intentionally redeclared in both
// `payroll_run` and `payslip` (per A17 modeling note: payslips freeze
// the snapshot so the run-time vocab can drift). Glob-re-exporting
// both would collide; payslip's variants stay accessible via
// `hrm_payroll_types::payslip::EarningLine` etc.
pub use attendance::*;
pub use compliance::*;
pub use department::*;
pub use employee::*;
pub use holiday::*;
pub use leave::*;
pub use payroll_run::*;
pub use payslip::{
    DownloadedEntry, Payslip, PayslipAttendanceSummary, PayslipBankInfo, PayslipEmployee,
    PayslipHeader, PayslipYtd,
};
pub use performance::*;
pub use salary_structure::*;
pub use settings::*;
