//! # crm-forms
//!
//! HTTP surface for the lead-capture Form entity. Name + slug + field
//! definitions + settings (redirect, captcha, success message) +
//! submissions counter. Status: `"draft"` | `"published"` | `"archived"`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
