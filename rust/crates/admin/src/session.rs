//! Admin-cookie verification, ported from `verifyAdminJwt` in
//! `src/lib/auth.ts` + `getAdminSession` in `src/lib/admin-session.ts`.
//!
//! The Next.js side reads the `admin_session` cookie, hands the raw token to
//! Rust via [`session_verify`], and uses the returned payload to decide
//! whether to render admin pages.
//!
//! ## Why a separate verifier from `sabnode-auth`?
//!
//! - `sabnode-auth` validates the **service-to-service** bearer tokens minted
//!   by `jwt-for-rust.ts` (issuer `"sabnode-bff"`, 15-min TTL). Those have
//!   `sub`/`tid`/`roles` claims and a different secret (`RUST_JWT_SECRET`).
//! - The **admin session cookie** is a 1-day token minted by
//!   `createAdminSessionToken` in `src/lib/auth.ts`, signed with `JWT_SECRET`
//!   (the user-session secret), and carries `role: "admin"` + `jti`.
//! - The two secrets and claim shapes are intentionally distinct, so the
//!   verifier lives here next to the rest of the admin surface.

use std::env;

use axum::{Json, extract::State};
use bson::{Document, doc};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::store::REVOKED_TOKENS_COLL;

#[derive(Debug, Deserialize, ToSchema)]
pub struct SessionVerifyBody {
    pub token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminSessionPayload {
    pub role: String,
    #[serde(rename = "loggedInAt", skip_serializing_if = "Option::is_none")]
    pub logged_in_at: Option<i64>,
    pub jti: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionVerifyResponse {
    #[serde(rename = "isAdmin")]
    pub is_admin: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<AdminSessionPayload>,
}

#[derive(Debug, Deserialize)]
struct RawClaims {
    role: String,
    #[serde(default)]
    #[serde(rename = "loggedInAt")]
    logged_in_at: Option<i64>,
    jti: String,
    exp: i64,
    iat: i64,
}

/// `POST /v1/admin/session/verify` — verify an `admin_session` JWT.
///
/// Returns `{ isAdmin: true, user }` when the token is valid, has
/// `role == "admin"`, and its `jti` is not in `revoked_tokens`. On any failure
/// — bad signature, expired, wrong role, revoked, or `JWT_SECRET` unset —
/// returns `{ isAdmin: false }` with status 200 so the caller can render the
/// login page without surfacing a 4xx.
///
/// Status codes are kept at 200 for the failure path to match the TS
/// `getAdminSession()` shape (which returns `{ isAdmin: false }` rather than
/// throwing). Only catastrophic Mongo errors propagate as 500.
pub async fn session_verify(
    State(mongo): State<MongoHandle>,
    Json(body): Json<SessionVerifyBody>,
) -> Result<Json<SessionVerifyResponse>> {
    let Ok(secret) = env::var("JWT_SECRET") else {
        // Same fail-closed posture as the TS verifier when the secret is
        // missing — the user just sees the login form.
        tracing::error!("admin session verify: JWT_SECRET is not configured");
        return Ok(Json(SessionVerifyResponse {
            is_admin: false,
            user: None,
        }));
    };

    if body.token.trim().is_empty() {
        return Ok(Json(SessionVerifyResponse {
            is_admin: false,
            user: None,
        }));
    }

    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    // The TS cookie carries `jti` + `exp` but no `iss`/`sub`/`aud`, so don't
    // require them. `exp` is validated by jsonwebtoken automatically.
    validation.required_spec_claims.clear();
    validation.required_spec_claims.insert("exp".to_owned());

    let claims = match decode::<RawClaims>(&body.token, &key, &validation) {
        Ok(data) => data.claims,
        Err(e) => {
            tracing::debug!(error = %e, "admin session verify: jwt decode failed");
            return Ok(Json(SessionVerifyResponse {
                is_admin: false,
                user: None,
            }));
        }
    };

    if claims.role != "admin" {
        return Ok(Json(SessionVerifyResponse {
            is_admin: false,
            user: None,
        }));
    }

    // Revocation check — mirror the TS `isTokenRevoked` fail-open: a Mongo
    // hiccup should not silently log out every admin in the deployment.
    let revoked = match mongo
        .collection::<Document>(REVOKED_TOKENS_COLL)
        .find_one(doc! { "jti": &claims.jti })
        .await
    {
        Ok(opt) => opt.is_some(),
        Err(e) => {
            tracing::warn!(error = %e, jti = %claims.jti, "revoked_tokens lookup failed; failing open");
            false
        }
    };
    if revoked {
        return Ok(Json(SessionVerifyResponse {
            is_admin: false,
            user: None,
        }));
    }

    Ok(Json(SessionVerifyResponse {
        is_admin: true,
        user: Some(AdminSessionPayload {
            role: claims.role,
            logged_in_at: claims.logged_in_at,
            jti: claims.jti,
            exp: claims.exp,
            iat: claims.iat,
        }),
    }))
}

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/session/verify", post(session_verify))
}
