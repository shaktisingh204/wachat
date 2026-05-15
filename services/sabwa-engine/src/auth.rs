//! Authentication middleware for the engine HTTP surface.
//!
//! Two distinct auth paths live here:
//!
//! 1. [`require_service_token`] — service-to-service trust between the
//!    Next.js layer (server actions, route handlers, workers) and this Rust
//!    engine. Callers present a single shared secret in the
//!    `X-Sabwa-Service-Token` header. The `/healthz` endpoint is mounted
//!    *before* this middleware in [`crate::build_app`] so liveness probes
//!    work without a token.
//!
//! 2. [`require_api_key`] — end-user-facing API keys gating the public
//!    `/v1/public/*` surface used by external integrators. Keys live in the
//!    `sabwa_api_keys` collection (only the SHA-256 hash + a short display
//!    prefix are persisted). On a hit the key's `project_id` and `scopes` are
//!    injected into the request extensions for downstream handlers.

use axum::{
    body::Body,
    extract::State,
    http::{header::HeaderName, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use bson::oid::ObjectId;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::state::AppState;

/// Header name carrying the shared service token.
pub const SERVICE_TOKEN_HEADER: HeaderName = HeaderName::from_static("x-sabwa-service-token");

/// Custom header carrying an end-user API key (alternative to `Authorization: Bearer ...`).
pub const API_KEY_HEADER: HeaderName = HeaderName::from_static("x-sabwa-api-key");

// ---------------------------------------------------------------------------
// Request-extension types populated by `require_api_key`.
// ---------------------------------------------------------------------------

/// The project that owns the API key presented on the current request.
///
/// Handlers behind [`require_api_key`] read this via `Extension<ApiKeyProject>`
/// to scope every read/write to the integrator's project.
#[derive(Debug, Clone)]
pub struct ApiKeyProject(pub ObjectId);

/// Scopes attached to the API key presented on the current request.
#[derive(Debug, Clone, Default)]
pub struct ApiKeyScopes(pub Vec<String>);

/// The `_id` of the API key row that authenticated this request — useful for
/// audit logs and rate limiting.
#[derive(Debug, Clone)]
pub struct ApiKeyId(pub ObjectId);

// ---------------------------------------------------------------------------
// Service-token middleware (Next.js → Rust).
// ---------------------------------------------------------------------------

/// Axum middleware that rejects any request whose
/// `X-Sabwa-Service-Token` header does not match
/// [`crate::config::Config::service_token`].
pub async fn require_service_token(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let expected = state.config.service_token.as_str();

    let provided = req
        .headers()
        .get(&SERVICE_TOKEN_HEADER)
        .and_then(|h| h.to_str().ok());

    match provided {
        Some(token) if constant_time_eq(token.as_bytes(), expected.as_bytes()) => {
            next.run(req).await
        }
        _ => unauthorized_service(),
    }
}

// ---------------------------------------------------------------------------
// End-user API-key middleware (external integrators → /v1/public/*).
// ---------------------------------------------------------------------------

/// Axum middleware enforcing a valid, non-revoked, non-expired API key.
///
/// Lookup order:
/// 1. `Authorization: Bearer <key>`
/// 2. `X-Sabwa-Api-Key: <key>`
///
/// On a hit the matching row's `project_id`, `scopes`, and `_id` are inserted
/// as request extensions and `last_used_at` / `usage_count` are bumped on a
/// best-effort basis (failures are logged, never propagated to the caller).
pub async fn require_api_key(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let presented = match extract_api_key(&req) {
        Some(k) => k,
        None => return Err(AppError::Unauthorized),
    };

    let hash = sha256_hex(presented.as_bytes());

    let repo = crate::db::misc::ApiKeysRepo::new(&state.db);
    let row = repo
        .find_by_hash(&hash)
        .await
        .map_err(AppError::Internal)?
        .ok_or(AppError::Unauthorized)?;

    if row.revoked {
        return Err(AppError::Unauthorized);
    }
    if let Some(exp) = row.expires_at {
        if exp <= Utc::now() {
            return Err(AppError::Unauthorized);
        }
    }

    let Some(key_id) = row.id else {
        return Err(AppError::Unauthorized);
    };

    // Inject context for downstream handlers BEFORE running them.
    req.extensions_mut().insert(ApiKeyProject(row.project_id));
    req.extensions_mut().insert(ApiKeyScopes(row.scopes.clone()));
    req.extensions_mut().insert(ApiKeyId(key_id));

    // Best-effort usage tracking — never block the request on a slow Mongo.
    let db = state.db.clone();
    tokio::spawn(async move {
        let repo = crate::db::misc::ApiKeysRepo::new(&db);
        if let Err(err) = repo.mark_used(&key_id).await {
            tracing::warn!(
                target: "sabwa_engine::auth",
                error = %err,
                "api_key mark_used failed (best-effort)"
            );
        }
    });

    Ok(next.run(req).await)
}

fn extract_api_key(req: &Request<Body>) -> Option<String> {
    if let Some(v) = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        if let Some(rest) = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer ")) {
            let trimmed = rest.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    req.headers()
        .get(&API_KEY_HEADER)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

/// SHA-256 of `bytes`, lowercase-hex encoded.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex_encode(&digest)
}

fn hex_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(ALPHABET[(b >> 4) as usize] as char);
        out.push(ALPHABET[(b & 0x0f) as usize] as char);
    }
    out
}

fn unauthorized_service() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "error": "missing or invalid service token",
            "code": "unauthorized",
        })),
    )
        .into_response()
}

/// Constant-time byte comparison to avoid timing oracles on the token.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ---------------------------------------------------------------------------
// Stream JWTs (browser → /v1/realtime/*).
// ---------------------------------------------------------------------------
//
// Browsers can't safely hold the service token, so they instead receive a
// short-lived HS256 JWT minted by `POST /v1/realtime/token` (which itself is
// gated by the service token, so only Next.js server code can mint).
//
// The token is bound to a `(projectId, sessionId)` pair and accepted as a
// `?token=<jwt>` query string by the SSE/WS handlers.

/// Default TTL applied to stream tokens when callers pass `0`.
pub const DEFAULT_STREAM_TOKEN_TTL_SECS: u64 = 600;

/// Env var name carrying the HS256 secret used to sign stream JWTs.
///
/// Falls back to [`crate::config::Config::service_token`] when unset so dev
/// setups don't need an extra secret. Production deployments should set this
/// explicitly to a value distinct from `SABWA_ENGINE_TOKEN`.
pub const STREAM_JWT_SECRET_ENV: &str = "SABWA_STREAM_JWT_SECRET";

/// Claims embedded in a short-lived realtime stream JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamClaims {
    /// SabWa session id this token is scoped to.
    pub sid: String,
    /// Project id the caller was acting under when the token was minted.
    pub pid: String,
    /// Issued-at (seconds since epoch).
    pub iat: u64,
    /// Expiration (seconds since epoch).
    pub exp: u64,
}

/// Resolve the HS256 secret used to sign stream tokens.
fn stream_jwt_secret(state: &AppState) -> String {
    std::env::var(STREAM_JWT_SECRET_ENV).unwrap_or_else(|_| state.config.service_token.clone())
}

/// Issue a short-lived HS256 JWT scoped to a `(projectId, sessionId)` pair.
///
/// Pass `ttl_secs = 0` to use [`DEFAULT_STREAM_TOKEN_TTL_SECS`] (10 minutes).
/// Returns `(token, exp_unix_seconds)`.
pub fn issue_stream_token(
    state: &AppState,
    session_id: &str,
    project_id: &str,
    ttl_secs: u64,
) -> Result<(String, u64), AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("system clock before epoch: {e}")))?
        .as_secs();
    let ttl = if ttl_secs == 0 {
        DEFAULT_STREAM_TOKEN_TTL_SECS
    } else {
        ttl_secs
    };
    let exp = now.saturating_add(ttl);

    let claims = StreamClaims {
        sid: session_id.to_string(),
        pid: project_id.to_string(),
        iat: now,
        exp,
    };

    let secret = stream_jwt_secret(state);
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to sign stream jwt: {e}")))?;

    Ok((token, exp))
}

/// Verify a stream JWT and return its claims, or [`AppError::Unauthorized`]
/// on any failure (bad signature, expired, malformed).
pub fn verify_stream_token(state: &AppState, token: &str) -> Result<StreamClaims, AppError> {
    let secret = stream_jwt_secret(state);
    let mut validation = Validation::default();
    validation.leeway = 5;
    decode::<StreamClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|err| {
        tracing::debug!(
            target: "sabwa_engine::auth::stream",
            error = %err,
            "stream token verification failed"
        );
        AppError::Unauthorized
    })
}
