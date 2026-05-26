//! # sabmail-rules
//!
//! SabMail — server-side filter rules. Mongo collection: `sabmail_rules`.
//!
//! TODO(integrator): workspace member + mount `/v1/sabmail/rules`.
//! TODO(IMAP/SMTP): the ingest worker must evaluate rules at delivery time;
//! today this crate only stores them.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
