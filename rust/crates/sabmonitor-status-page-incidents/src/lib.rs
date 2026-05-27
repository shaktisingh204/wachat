//! # sabmonitor-status-page-incidents
//!
//! Hand-curated incident posts that show up on a public status page (think
//! "investigating → identified → monitoring → resolved" timeline).
//! Mount under `/v1/sabmonitor/status-page-incidents`. Public read by
//! statusPageId is `public_router()` mounted at
//! `/v1/sabmonitor/status-page-incidents-public/{statusPageId}`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{public_router, router};
