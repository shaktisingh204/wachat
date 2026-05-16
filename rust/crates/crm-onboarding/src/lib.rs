//! # crm-onboarding
//!
//! HTTP surface for the Onboarding entity. HR new-hire onboarding
//! workflows: employee + candidate + joining date + buddy + manager +
//! checklist (W9 etc.) + progress + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
