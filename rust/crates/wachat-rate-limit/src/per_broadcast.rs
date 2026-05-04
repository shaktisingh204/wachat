//! Per-broadcast convenience wrapper around `TokenBucket`.
//!
//! The broadcast pipeline applies a configured messages-per-second (MPS)
//! ceiling per broadcast, enforced **globally** across every PM2 worker
//! instance via Redis. The existing Node implementation lives in
//! `src/workers/broadcast/rate-limiter.js`; this Rust wrapper exists so
//! Rust producers / handlers can charge against the same bucket without
//! re-implementing the bucket math at every call site.
//!
//! Bucket key layout:
//!     wrl:bucket:bcast:tb:<broadcastId>
//!
//! The `bcast:tb:` segment matches the existing TS `bucketKey()` helper
//! (`src/workers/broadcast/rate-limiter.js` `bucketKey`). The `wrl:bucket:`
//! prefix is added by `TokenBucket::redis_key`. **Note**: this means the
//! Rust bucket key is NOT byte-identical to the TS one; see the README for
//! the migration plan to reconcile them. Until then, do NOT mix Rust and
//! Node acquirers against the same broadcast — pick one side per
//! broadcast for the duration of its run.

use sabnode_common::ApiError;

use crate::bucket::{AcquireResult, TokenBucket};

/// Per-broadcast token-bucket limiter. Capacity = MPS, refill rate = MPS,
/// allowing exactly a 1-second burst — same shape as the Node limiter.
#[derive(Clone)]
pub struct BroadcastLimiter {
    inner: TokenBucket,
}

impl BroadcastLimiter {
    /// Wrap a `TokenBucket`. The bucket can carry a non-default prefix; the
    /// broadcast wrapper only owns the per-broadcast key suffix.
    pub fn new(inner: TokenBucket) -> Self {
        Self { inner }
    }

    /// Borrow the inner generic limiter — exposed for callers that want to
    /// tweak the prefix or run advanced introspection without re-wiring.
    pub fn inner(&self) -> &TokenBucket {
        &self.inner
    }

    /// Compute the bucket key suffix used for a broadcast. Public so tests
    /// and admin tooling can compute the full Redis key by combining this
    /// with `TokenBucket::redis_key`.
    pub fn bucket_key(broadcast_id: &str) -> String {
        // Identical layout to the Node `bucketKey(broadcastId)` helper:
        //   `bcast:tb:<broadcastId>`
        // Keep this in sync with `src/workers/broadcast/rate-limiter.js`.
        format!("bcast:tb:{broadcast_id}")
    }

    /// Try to charge a single message send against the broadcast's bucket.
    ///
    /// Capacity and refill are both `mps`: the bucket holds at most one
    /// second of burst, refilled at exactly the configured rate. Cost is
    /// always 1 — callers that want to charge a batch should call N times
    /// (matches the granularity at which the Node sender retries on
    /// per-message Meta API failures).
    pub async fn try_send(&self, broadcast_id: &str, mps: u32) -> Result<AcquireResult, ApiError> {
        if broadcast_id.is_empty() {
            return Err(ApiError::Validation("broadcast_id cannot be empty".into()));
        }
        if mps == 0 {
            return Err(ApiError::Validation("mps must be > 0".into()));
        }

        let bucket_key = Self::bucket_key(broadcast_id);
        // Capacity = mps (1s burst), refill = mps tokens/sec, cost = 1.
        // Mirrors the Node call site exactly:
        //   redis.bcastAcquire(key, String(mps), String(Date.now()), "1")
        self.inner.try_acquire(&bucket_key, mps, mps, 1).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bucket_key_matches_node_layout() {
        // Locked in: this MUST stay equal to the Node `bucketKey()` helper
        // for cross-process coordination to work.
        assert_eq!(BroadcastLimiter::bucket_key("abc123"), "bcast:tb:abc123");
    }
}
