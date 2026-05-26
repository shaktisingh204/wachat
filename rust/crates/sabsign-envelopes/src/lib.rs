//! # sabsign-envelopes
//!
//! SabSign envelope entity. An envelope wraps a single SabFile (the
//! source document) plus an ordered list of signers, each with their own
//! authentication tier, fields to fill in, and per-signer audit trail.
//!
//! Routing modes:
//!   * `sequential` — signers act in `routingOrder` order; signer N+1
//!     gets notified only after signer N completes.
//!   * `parallel`   — all signers can sign simultaneously.
//!   * `conditional`— next signer is selected by evaluating a JSON-Logic
//!     style rule against fields already filled (stored in the envelope's
//!     `routingRules`).
//!
//! Reads/writes `esign_envelopes`. Fields embedded in the envelope are
//! the source of truth — the standalone `esign_fields` collection is a
//! denormalised projection used for cross-envelope analytics.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
