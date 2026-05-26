//! # agile-burndown
//!
//! Daily burndown samples per active sprint. Each row records the remaining
//! story points at the end of a given sprint day. Used to render the ideal
//! vs actual burndown line chart on the sprint dashboard.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
