//! # sabnode-users
//!
//! User-domain HTTP surface for the SabNode Rust BFF. The first endpoint here
//! — `GET /v1/me` — is the **reference slice** for Phase 0 of the Rust
//! migration: it exercises the full authn → DB → DTO pipeline so every other
//! domain crate (projects, contacts, broadcasts, ...) can copy this shape.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's app-state type `S`. As long as
//! `S` can produce the handles the handlers need (Mongo for storage, the auth
//! config for JWT verification), it slots in. This is the standard axum
//! `FromRef` pattern and keeps each domain crate decoupled from a single
//! monolithic state struct.
//!
//! Mount under `/v1` from the `api` crate:
//!
//! ```ignore
//! let v1 = sabnode_users::router::<AppState>();
//! ```

pub mod dto;
pub mod handlers;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

/// Build the user-domain router.
///
/// `S` is the caller's application state. Required `FromRef` impls give
/// handlers access to a Mongo handle and the auth verifier without forcing
/// every crate to share one giant state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/me", get(handlers::me))
}
