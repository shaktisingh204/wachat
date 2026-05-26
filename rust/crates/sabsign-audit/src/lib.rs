//! # sabsign-audit
//!
//! Append-only audit log for SabSign envelopes. Each event is hash-chained
//! against its JSON payload so any tampering is detectable. Writes are
//! performed inline by `sabsign-envelopes`; this crate exposes only the
//! read surface used by the UI + audit-trail PDF generator.
//!
//! Event kinds: `envelope_created`, `envelope_sent`, `envelope_updated`,
//! `envelope_voided`, `envelope_completed`, `signer_notified`,
//! `signer_viewed`, `signer_completed`, `signer_declined`,
//! `field_filled`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
