//! # developer-oauth
//!
//! OAuth 2.0 (Authorization Code + PKCE) server.
//!
//! ## Collections
//!
//! - `oauth_apps`            — registered third-party apps (one row per
//!                             developer-registered client_id).
//! - `oauth_authorization_codes` — short-lived (10m) codes issued after
//!                             a tenant grants consent.
//! - `oauth_access_tokens`   — read by the Next.js `verifyApiKey` path
//!                             when the bearer starts with `sab_oat_`.
//! - `oauth_refresh_tokens`  — long-lived refresh tokens; rotated on use.
//!
//! ## Endpoints (mount under `/v1/oauth`)
//!
//! | Method | Path             | Purpose                                              |
//! | ------ | ---------------- | ---------------------------------------------------- |
//! | POST   | `/apps`           | Register a new third-party app (client_id+secret).   |
//! | GET    | `/apps`           | List the calling developer's apps.                   |
//! | DELETE | `/apps/{appId}`   | Delete an app + cascade revoke its tokens.           |
//! | POST   | `/authorize`      | Server-side authorize: tenant grants consent, mints code. |
//! | POST   | `/token`          | Exchange code for access+refresh, OR refresh tokens. |
//! | POST   | `/revoke`         | Revoke an access or refresh token (RFC 7009).        |
//! | POST   | `/introspect`     | RFC 7662 token introspection.                        |
//!
//! The `/authorize` page itself (the consent UI) lives on the Next.js
//! side at `/oauth/authorize`. It calls this `POST /authorize` endpoint
//! once the tenant clicks "Allow".

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

pub use state::DeveloperOauthState;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/apps", get(handlers::list_apps).post(handlers::register_app))
        .route("/apps/{app_id}", delete(handlers::delete_app))
        .route("/authorize", post(handlers::authorize))
        .route("/token", post(handlers::token))
        .route("/revoke", post(handlers::revoke))
        .route("/introspect", post(handlers::introspect))
}
