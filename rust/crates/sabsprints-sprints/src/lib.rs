//! # sabsprints-sprints
//!
//! HTTP surface for the Sprint entity. A time-boxed iteration tied to a
//! project, with a goal, start/end dates, capacity (story points), and a
//! lifecycle status (planned | active | completed | cancelled).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
