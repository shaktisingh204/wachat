//! # crm-form-submissions
//!
//! HTTP surface for the Form Submission entity. Each row in
//! `crm_form_submissions` captures a single lead-capture form submission
//! tied to a `crm_forms` document. The `data` field holds the raw
//! field-name → value blob; the rest is provenance metadata
//! (source URL, IP, user agent, referrer) plus a lifecycle status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
