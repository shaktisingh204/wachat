//! # sabsign-envelopes
//!
//! The keystone SabSign entity. An *envelope* bundles one source document
//! (`docId` → a SabFiles node), a list of signers, the fields placed on the
//! document, a routing order, and the signing state machine
//! (`draft → sent → in_progress → completed | declined | voided | expired`).
//!
//! Persisted in `esign_envelopes`, tenant-scoped by the JWT `tid`. Wire shape
//! matches the TS `SabSignEnvelopeDoc` contract exactly (string ids + ISO
//! string timestamps).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
