//! # sabcliq-workspaces
//!
//! HTTP surface for SabCliq Workspaces — the top-level container for
//! internal-team chat (channels live inside a workspace). Usually one
//! workspace per tenant, but the API supports multiple.
//!
//! Mounted under `/v1/sabcliq/workspaces` from the orchestrating `api`
//! crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
