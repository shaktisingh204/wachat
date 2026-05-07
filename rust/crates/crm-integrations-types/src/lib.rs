//! # crm-integrations-types
//!
//! DTOs for CRM Integrations & Settings (`crm_function_plan.md` §8):
//! third-party integration configs and tenant-level settings.

pub mod integration;
pub mod settings;

pub use integration::*;
pub use settings::*;
