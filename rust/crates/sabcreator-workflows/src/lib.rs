//! # sabcreator-workflows
//!
//! Workflow definition for SabCreator. Each workflow has a `trigger`
//! (form_submit, record_change, cron, button_click) and either references
//! a SabFlow flow (`sabflowRefId`) or carries inline step JSON.
//!
//! Mongo collection: `sabcreator_workflows`. Mount under
//! `/v1/sabcreator/workflows`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
