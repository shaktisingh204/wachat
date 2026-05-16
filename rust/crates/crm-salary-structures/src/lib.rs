//! # crm-salary-structures
//!
//! HTTP surface for the Salary Structure entity. Captures an employee's
//! compensation breakdown: basic + HRA + DA + other allowances, against
//! deductions like PF (employer/employee), ESI, professional tax — with
//! optional precomputed gross / net.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
