//! # sabpractice-document-requests
//!
//! HTTP surface for SabPractice document-request entities. Tracks a list
//! of required files the firm has asked from a client (e.g. "bank
//! statement Jan", "GST invoices Q3"). Each requested file has its own
//! status; when the firm uploads a SabFiles file, its `fileId` binds in.
//!
//! Mount under `/v1/sabpractice/document-requests`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
