//! # sabsheet-ops
//!
//! Authoritative op-apply endpoint for SabSheet v2. Applies intent-based [`Command`] batches to a
//! server-side [`SabEngine`], persists the workbook snapshot + op log, and returns the engine diff
//! blob for clients to replay and (later) broadcast over the collab gateway.
//!
//! [`Command`]: sabsheet_engine::ops::Command
//! [`SabEngine`]: sabsheet_engine::SabEngine

pub mod docs;
pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
