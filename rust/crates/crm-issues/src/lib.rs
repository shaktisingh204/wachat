//! # crm-issues
//!
//! HTTP surface for the Project Issue entity. Project + milestone +
//! assignee + reporter + issue type + priority + severity + status +
//! labels + due/resolved tracking.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
