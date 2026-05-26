//! # pagesense-sites
//!
//! The registered-site entity for PageSense (CRO module). A "site" is a
//! domain the user wants to instrument — it owns a unique `snippetKey`
//! that the client snippet uses to authenticate event ingestion, plus
//! a stub `screenshotUrl` for the heatmap viewer until a screenshot
//! service is wired in (TODO: real screenshot capture, e.g. via a
//! headless browser worker).
//!
//! Mongo collection: `pagesense_sites`.
//! Every doc is scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
