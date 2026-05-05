//! # wachat-public-api
//!
//! Public REST API surface for wachat — the API-key-authenticated endpoints
//! that customers (and partner integrations) hit directly. Mounted at
//! `/v1/wachat/public/*` to make the auth flavor explicit at the URL level
//! versus the JWT-auth `/v1/wachat/*` surface in `wachat-send-router`.
//!
//! ## Ported from
//!
//! `src/app/api/v1/messages/route.ts` — the `withApiV1` + `verifyApiKey`
//! pipeline (see `src/lib/api-platform/handler.ts` and `auth.ts`).
//!
//! ## Auth
//!
//! [`ApiKeyAuth`] is the extractor handlers use. It pulls a bearer token off
//! the request (matches the TS extractor: `Authorization: Bearer <token>`
//! with `X-Api-Key` as a fallback), SHA-256-hex-hashes it (mirrors
//! `createHash('sha256').update(plain).digest('hex')` in `auth.ts`), and
//! looks the digest up in the `api_keys` Mongo collection. The key resolves
//! to `(tenantId, scopes, tier, keyId)`.
//!
//! Revoked keys (`{ revoked: true }`) are rejected. `lastUsedAt` is bumped
//! fire-and-forget — never blocking the request.
//!
//! ## Rate limit
//!
//! Per-API-key, backed by [`wachat_rate_limit::TokenBucket`]. The bucket
//! key is `apikey:<keyId>` so each key gets its own ceiling regardless of
//! tenant. Tier defaults match the TS `rate-limit.ts` defaults (60 RPM /
//! 600 RPM / 6000 RPM for FREE/PRO/ENTERPRISE — capacity = RPM, refill =
//! RPM/60 per second).
//!
//! ## Engine reuse
//!
//! Sends are delegated to [`wachat_send::MessageSender`] (Phase 4 slice 1)
//! via [`PublicApiState`] — this crate owns no Meta-side logic.

#![forbid(unsafe_code)]

pub mod auth;
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_db::mongo::MongoHandle;

pub use auth::{ApiAuthContext, ApiKeyAuth, ApiKeyVerifier};
pub use state::PublicApiState;

/// Build the public-API router.
///
/// Routes (mounted relative — caller nests under `/v1/wachat/public`):
///
/// ```text
/// POST /messages   — send a WA message via API key (text / media)
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`PublicApiState`] bundle and a [`MongoHandle`] (used by the
/// [`ApiKeyAuth`] extractor for the `api_keys` collection lookup); both
/// are pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    PublicApiState: FromRef<S>,
    Arc<ApiKeyVerifier>: FromRef<S>,
    MongoHandle: FromRef<S>,
{
    Router::new().route("/messages", post(handlers::send_message))
}
