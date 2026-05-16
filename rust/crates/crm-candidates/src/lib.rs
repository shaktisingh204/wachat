//! # crm-candidates
//!
//! HTTP surface for the Candidate entity (HR applicant tracking).
//! Candidate identifies a job applicant — name, email, contact details,
//! job association, resume, stage in the hiring pipeline, and rating.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
