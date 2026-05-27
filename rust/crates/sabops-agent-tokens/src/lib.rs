//! # sabops-agent-tokens
//!
//! Endpoint-agent enrollment tokens. The admin generates a token with an
//! intended OS; the agent installer ships that token in its command line
//! and exchanges it for a permanent endpoint identity on first contact
//! at `/api/sabops/agent/enroll` (Next.js route handler).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
