//! # sabnode-admin
//!
//! Backend HTTP surface for the SabNode admin panel. Ports the TS server
//! actions in `src/app/actions/admin.actions.ts` to Rust so the Next.js admin
//! pages can shrink to thin proxies that forward to Rust over `rustAdminFetch`
//! (see `src/lib/rust-client/fetcher.ts`).
//!
//! ## Auth model
//!
//! The admin cookie (`admin_session`) is owned by Next.js and never leaves the
//! TS process. When a Next.js server action wants to call an admin-gated Rust
//! route, it:
//!
//! 1. Verifies the admin cookie via `getAdminSession()` (existing TS code).
//! 2. Mints a short-lived bearer JWT with `roles: ["admin"]` via
//!    `rustAdminFetch` in `src/lib/rust-client/fetcher.ts`.
//! 3. Calls the Rust endpoint with `Authorization: Bearer <token>`.
//!
//! On the Rust side the bearer is verified by the standard
//! [`sabnode_auth`] extractor, and admin-only routes apply the
//! [`sabnode_auth::require_role`] middleware.
//!
//! ## Phase 1 routes (open — no admin role required)
//!
//! These bootstrap the admin session itself; the caller doesn't yet have a
//! cookie when they hit them.
//!
//! | Method | Path                     | Handler                       | Purpose                                       |
//! | ------ | ------------------------ | ----------------------------- | --------------------------------------------- |
//! | GET    | `/configured`            | `handlers::is_configured`     | First-time setup check                        |
//! | POST   | `/setup`                 | `handlers::setup`             | Create the initial admin credentials          |
//! | POST   | `/login`                 | `handlers::login`             | Verify email + bcrypt password                |
//! | POST   | `/logout/revoke`         | `handlers::logout_revoke`     | Insert a JTI into `revoked_tokens`            |
//!
//! Mount under `/v1/admin` from the `api` crate.

pub mod dto;
pub mod guard;
pub mod handlers;
pub mod plans;
pub mod projects;
pub mod settings;
pub mod store;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

/// Build the open (unauthenticated) admin router — Phase 1.
///
/// These endpoints establish or revoke the admin session; the caller does not
/// (yet) have an admin bearer to present. Admin-gated handlers are mounted
/// separately by [`admin_router`].
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/configured", get(handlers::is_configured))
        .route("/setup", post(handlers::setup))
        .route("/login", post(handlers::login))
        .route("/logout/revoke", post(handlers::logout_revoke))
        .merge(projects::routes::<S>())
        .merge(settings::routes::<S>())
        .merge(plans::routes::<S>())
}
