//! # sabsign-audit
//!
//! Tamper-evident audit trail for SabSign. Every envelope lifecycle event is
//! appended to `esign_audit_events` with a SHA-256 hash chained off the
//! previous event for the same envelope, so the trail can be verified
//! end-to-end (`chainValid`).
//!
//! Ids and timestamps are stored and returned as plain strings to match the
//! TS wire contract (`SabSignAuditEvent`) exactly — no `{$oid}`/`{$date}`
//! extended-JSON wrappers leak to the browser.

pub mod chain;
pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use chain::{append_event, hash_event, verify_chain};
pub use router::router;
pub use types::EsignAuditEvent;
