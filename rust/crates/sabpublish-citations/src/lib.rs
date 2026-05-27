//! # sabpublish-citations
//!
//! Discovered citations (NAP mentions) for a location across the web.
//! Inserted by the citation crawler (deferred). The UI lets the user
//! claim or dispute each mention. Mongo collection: `sabpublish_citations`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
