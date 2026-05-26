//! # pagesense-funnels
//!
//! Funnel definitions — ordered steps the user wants to track through
//! their site. Each step matches by either URL (pageview) or event
//! name (custom JS event from the snippet, future). Mongo collection:
//! `pagesense_funnels`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
