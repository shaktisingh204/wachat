//! # sabops-endpoints
//!
//! SabOps Endpoint registry. Hosts the agent-managed device fleet
//! (windows | macos | linux | ios | android) with heartbeats, status,
//! tags and health-score under `/v1/sabops/endpoints`.
//!
//! Companion Mongo collection: `sabops_endpoints`. Documents are scoped
//! by `userId` (the admin tenant). The endpoint-agent heartbeat path is
//! authenticated via short-lived agent-token (see `sabops-agent-tokens`)
//! and lives in the Next.js `/api/sabops/agent/*` route handlers — this
//! crate only exposes the admin-session surface.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
