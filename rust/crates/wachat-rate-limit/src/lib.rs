//! # wachat-rate-limit
//!
//! Redis token-bucket rate limiter for the SabNode Rust port. Primary use
//! case is per-broadcast Meta Cloud API throttling — the existing Node
//! workers (`src/workers/broadcast/rate-limiter.js`) cap each broadcast at
//! a configured messages-per-second (MPS) using a Redis-backed bucket; this
//! crate gives Rust producers / handlers the same primitive so they can
//! charge against the same bucket and obey the same global ceiling.
//!
//! ## Algorithm
//!
//! Standard token bucket:
//!   * `capacity` tokens, each acquire costs `cost`.
//!   * Bucket refills at `refill_per_sec` tokens / second.
//!   * State (`tokens`, `ts`) lives in a Redis HASH with a 60s TTL so
//!     idle buckets don't pile up.
//!   * Check + refill + decrement runs inside a Lua script for atomicity
//!     across concurrent acquirers.
//!
//! ## Wire compatibility with the Node limiter
//!
//! The bucket schema (HASH fields `tokens` + `ts`, 60s TTL, refill formula
//! `tokens + elapsed_sec * mps` clamped to capacity) matches
//! `src/workers/broadcast/rate-limiter.js` exactly. The bucket *key*,
//! however, currently differs:
//!
//!   * Node side: `bcast:tb:<broadcastId>`
//!   * Rust side: `wrl:bucket:bcast:tb:<broadcastId>`  (the `wrl:bucket:`
//!     prefix is added by `TokenBucket::redis_key`)
//!
//! That deliberate prefix lets Rust-side limiters share a Redis with other
//! state without colliding, but it means until we reconcile keys (either
//! by adding the same prefix on the Node side, or by switching the Rust
//! `BroadcastLimiter` to bypass the prefix) **a single broadcast must be
//! acquired from one side only** — mixing sides for the same broadcast
//! will let each side burn through tokens the other doesn't see, and the
//! broadcast will exceed its configured MPS.
//!
//! ## Example
//!
//! ```no_run
//! use sabnode_db::redis::RedisHandle;
//! use wachat_rate_limit::{BroadcastLimiter, TokenBucket, AcquireResult};
//!
//! # async fn run() -> Result<(), sabnode_common::ApiError> {
//! let redis = RedisHandle::connect("redis://localhost:6379").await
//!     .map_err(sabnode_common::ApiError::Internal)?;
//! let limiter = BroadcastLimiter::new(TokenBucket::new(redis));
//!
//! match limiter.try_send("bcast_123", 10).await? {
//!     AcquireResult::Granted => {
//!         // proceed with the Meta API call
//!     }
//!     AcquireResult::Denied { retry_after_ms } => {
//!         tokio::time::sleep(std::time::Duration::from_millis(retry_after_ms)).await;
//!     }
//! }
//! # Ok(()) }
//! ```

pub mod bucket;
pub mod per_broadcast;
pub mod script;

// Re-export the public surface so `use wachat_rate_limit::{...}` works
// without subpath imports.
pub use bucket::{AcquireResult, DEFAULT_KEY_PREFIX, TokenBucket};
pub use per_broadcast::BroadcastLimiter;
pub use script::ACQUIRE_LUA;
