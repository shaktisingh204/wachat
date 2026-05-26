//! # sabsprints-epics
//!
//! HTTP surface for the Epic entity. A roadmap-scale grouping of stories with
//! a color marker, optional date window, and lifecycle status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
