//! # sabpractice-clients
//!
//! HTTP surface for SabPractice Client entities — the businesses whose
//! books / advisory work the firm manages. Distinct from CRM accounts;
//! lives in its own collection so the firm can manage clients that
//! aren't in the firm's sales pipeline.
//!
//! Mount under `/v1/sabpractice/clients`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
