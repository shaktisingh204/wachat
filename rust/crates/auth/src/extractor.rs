//! Axum extractor that turns a verified JWT into an [`AuthUser`] handlers can
//! use directly.
//!
//! Wire it into the router by registering an [`AuthConfig`] in state:
//!
//! ```ignore
//! use std::sync::Arc;
//! use axum::{Router, routing::get};
//! use sabnode_auth::{AuthConfig, AuthUser};
//!
//! async fn me(user: AuthUser) -> String {
//!     format!("hello {}", user.user_id)
//! }
//!
//! let cfg = Arc::new(AuthConfig {
//!     secret: std::env::var("RUST_JWT_SECRET").unwrap().into_bytes(),
//! });
//! let app = Router::new().route("/me", get(me)).with_state(cfg);
//! ```

use std::sync::Arc;

use axum::{
    extract::{FromRef, FromRequestParts},
    http::{HeaderValue, request::Parts},
};

use crate::{error::AuthError, jwt};

/// Shared verifier configuration. Stored as `State<Arc<AuthConfig>>` (or any
/// app state from which `Arc<AuthConfig>` can be extracted via `FromRef`).
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Raw bytes of the HS256 shared secret. Read once from
    /// `RUST_JWT_SECRET` at startup.
    pub secret: Vec<u8>,
}

/// Authenticated user populated from a valid JWT.
///
/// Use as a handler argument:
///
/// ```ignore
/// async fn handler(user: AuthUser) { /* ... */ }
/// ```
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub tenant_id: String,
    pub roles: Vec<String>,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    Arc<AuthConfig>: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let cfg: Arc<AuthConfig> = Arc::<AuthConfig>::from_ref(state);

        let header: &HeaderValue = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .ok_or(AuthError::Missing)?;

        let raw = header.to_str().map_err(|_| AuthError::Malformed)?;
        let token = raw
            .strip_prefix("Bearer ")
            .or_else(|| raw.strip_prefix("bearer "))
            .ok_or(AuthError::Missing)?
            .trim();

        if token.is_empty() {
            return Err(AuthError::Missing);
        }

        let claims = jwt::verify(token, &cfg.secret)?;

        // Cache the raw claims on request extensions so downstream layers
        // (e.g. tracing, audit logging) can read them without re-decoding.
        parts.extensions.insert(claims.clone());

        Ok(AuthUser {
            user_id: claims.sub,
            tenant_id: claims.tid,
            roles: claims.roles,
        })
    }
}
