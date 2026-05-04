//! Per-route role enforcement middleware.
//!
//! Wire it onto a route or router that has [`AuthConfig`] in state:
//!
//! ```ignore
//! use std::sync::Arc;
//! use axum::{Router, routing::post, middleware::from_fn_with_state};
//! use sabnode_auth::{AuthConfig, require_role};
//!
//! let cfg = Arc::new(AuthConfig { secret: vec![] });
//!
//! let admin_routes = Router::new()
//!     .route("/projects/:id", post(delete_project))
//!     .layer(from_fn_with_state(cfg.clone(), require_role("admin")))
//!     .with_state(cfg);
//! ```
//!
//! The middleware verifies the JWT, checks for the required role, and stashes
//! the resulting [`AuthUser`] in request extensions so the wrapped handler can
//! pull it out without re-verifying.

use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::{
    error::AuthError,
    extractor::{AuthConfig, AuthUser},
    jwt,
};

/// Build a middleware function that requires `AuthUser.roles` to contain
/// `role`.
///
/// Returns:
/// - `401 Unauthorized` if the JWT is missing, malformed, expired, has a bad
///   signature, or has the wrong issuer.
/// - `403 Forbidden` if the JWT is valid but does not include `role`.
///
/// Use with [`axum::middleware::from_fn_with_state`], passing
/// `Arc<AuthConfig>` as the state.
#[allow(clippy::type_complexity)] // axum middleware fn signature is inherently verbose
pub fn require_role(
    role: &'static str,
) -> impl Fn(
    State<Arc<AuthConfig>>,
    Request,
    Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send>>
+ Clone
+ Send
+ Sync
+ 'static {
    move |State(cfg): State<Arc<AuthConfig>>, mut req: Request, next: Next| {
        Box::pin(async move {
            // 1. Pull the bearer token off the request.
            let token = match extract_bearer(&req) {
                Ok(t) => t,
                Err(e) => return auth_error_response(e),
            };

            // 2. Verify the JWT.
            let claims = match jwt::verify(&token, &cfg.secret) {
                Ok(c) => c,
                Err(e) => return auth_error_response(e),
            };

            // 3. Enforce the role.
            if !claims.roles.iter().any(|r| r == role) {
                return (
                    StatusCode::FORBIDDEN,
                    format!("missing required role: {role}"),
                )
                    .into_response();
            }

            // 4. Stash AuthUser + raw Claims for downstream handlers.
            let user = AuthUser {
                user_id: claims.sub.clone(),
                tenant_id: claims.tid.clone(),
                roles: claims.roles.clone(),
            };
            req.extensions_mut().insert(claims);
            req.extensions_mut().insert(user);

            next.run(req).await
        })
    }
}

fn extract_bearer(req: &Request) -> Result<String, AuthError> {
    let header = req
        .headers()
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

    Ok(token.to_string())
}

fn auth_error_response(err: AuthError) -> Response {
    (StatusCode::UNAUTHORIZED, err.to_string()).into_response()
}
