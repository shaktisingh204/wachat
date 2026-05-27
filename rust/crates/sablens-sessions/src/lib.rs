//! # sablens-sessions
//!
//! SabLens — AR remote-support session entity. A technician creates a
//! session, the customer joins via an opaque `customerJoinToken`, and the
//! technician sees the customer's camera feed plus draws spatial
//! annotations.
//!
//! Two routers:
//!   * `router()` — technician-side, requires JWT. Mount under
//!     `/v1/sablens/sessions`.
//!   * `public_router()` — customer-facing, keyed only by
//!     `customerJoinToken`. Mount under `/v1/sablens/sessions-public`.
//!
//! Mongo collection: `sablens_sessions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{public_router, router};
