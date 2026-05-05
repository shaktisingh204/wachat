//! Application state slice consumed by the public-API router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for three things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. A [`PublicApiState`] — the bundle of engine handles below.
//! 2. An `Arc<ApiKeyVerifier>` — for the [`ApiKeyAuth`](crate::auth::ApiKeyAuth) extractor.
//! 3. A [`MongoHandle`] — for project lookups inside handlers.
//!
//! Each engine handle is internally `Arc`-backed and cheap to clone, so
//! the bundle itself is also cheap.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;
use wachat_rate_limit::TokenBucket;
use wachat_send::MessageSender;

/// Bundle of engine handles the public-API router needs to satisfy every
/// route. Clone is cheap — every field is `Arc`-backed.
#[derive(Clone)]
pub struct PublicApiState {
    /// Main text + media sender (from `wachat-send`). Reused — this crate
    /// does not reimplement Meta-side delivery.
    pub message: Arc<MessageSender>,

    /// Per-API-key rate limiter. Backed by Redis via the shared
    /// `wachat-rate-limit` token-bucket primitive. The handler keys
    /// buckets by `apikey:<keyId>` so each key gets its own ceiling.
    pub rate_limit: Arc<TokenBucket>,

    /// Mongo handle for direct project lookups (per-project tenancy
    /// guard runs before delegating to [`MessageSender::send`]).
    pub mongo: MongoHandle,
}
