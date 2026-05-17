//! # crm-certifications
//!
//! HTTP surface for the Certification entity. Tracks issuer, certification
//! number, issue and expiry dates, and a SabFiles certificate URL. Reads/
//! writes `crm_certifications`.
//!
//! Note: the TS server actions persist a few keys in snake_case
//! (`employee_id`, `employee_name`, `certification_number`, `issue_date`,
//! `expiry_date`, `certificate_url`). The Rust type mirrors that exactly via
//! `serde(rename)` so the two paths stay byte-compatible.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
