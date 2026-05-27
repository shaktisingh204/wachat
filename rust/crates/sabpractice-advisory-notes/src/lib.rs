//! # sabpractice-advisory-notes
//!
//! HTTP surface for SabPractice advisory notes — markdown insights/risks/
//! action items the firm captures for a client. Drafts stay private; the
//! `share` endpoint marks them as visible to the client portal.
//!
//! Mount under `/v1/sabpractice/advisory-notes`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
