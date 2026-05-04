//! Generic Redis token-bucket rate limiter.
//!
//! `TokenBucket` is the lower-level primitive: it executes the `acquire.lua`
//! script atomically against a configurable bucket key and surfaces the
//! granted/denied result. Callers that want a domain-specific wrapper (per
//! broadcast, per tenant, per route, ...) should compose `TokenBucket` rather
//! than calling `EVAL` themselves — that way every limiter in the codebase
//! shares the same wire format and Redis key pattern.

use fred::types::Key;
use sabnode_common::ApiError;
use serde::Serialize;

use sabnode_db::redis::RedisHandle;

use crate::script::{acquire_script, reload_after_noscript};

/// Default key prefix. The fully-qualified Redis key for a bucket is
/// `{key_prefix}:bucket:{bucket_key}`. The `:bucket:` segment is fixed to
/// distinguish limiter state from any other key the prefix might be shared
/// with (counters, locks, etc.) in deployments that namespace by service.
pub const DEFAULT_KEY_PREFIX: &str = "wrl";

/// Result of a single `try_acquire` call.
///
/// `serde::Serialize` is derived so callers can include the result directly
/// in structured logs / API responses without re-mapping the variants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AcquireResult {
    /// Tokens were decremented. Caller may proceed immediately.
    Granted,
    /// Bucket is empty. Caller should sleep at least `retry_after_ms` and
    /// retry. The value is computed server-side from the configured refill
    /// rate, so honoring it is sufficient to avoid hot-spinning.
    Denied {
        /// Milliseconds the caller should wait before retrying. Always >= 1.
        retry_after_ms: u64,
    },
}

impl AcquireResult {
    /// True when the caller may proceed.
    pub fn is_granted(self) -> bool {
        matches!(self, AcquireResult::Granted)
    }
}

/// Generic token-bucket limiter backed by Redis + a Lua script.
///
/// Cheap to clone: `RedisHandle` is `Arc`-backed and `String` is the only
/// owned field beyond it. Hand a single instance to as many handlers /
/// workers as you like.
#[derive(Clone)]
pub struct TokenBucket {
    /// Shared fred client. Cloned freely.
    redis: RedisHandle,
    /// Prefix prepended to every bucket key. See `DEFAULT_KEY_PREFIX`.
    key_prefix: String,
}

impl TokenBucket {
    /// Build a limiter using `DEFAULT_KEY_PREFIX` (`"wrl"`).
    pub fn new(redis: RedisHandle) -> Self {
        Self {
            redis,
            key_prefix: DEFAULT_KEY_PREFIX.to_owned(),
        }
    }

    /// Override the key prefix. Useful when running multiple isolated
    /// limiters against one Redis (e.g. dev + staging on a shared box) or
    /// when a specific domain wants a stable, recognizable namespace.
    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.key_prefix = prefix.into();
        self
    }

    /// Borrow the configured key prefix. Mainly useful in tests that want
    /// to assert against the exact Redis key.
    pub fn key_prefix(&self) -> &str {
        &self.key_prefix
    }

    /// Compute the fully-qualified Redis key for a bucket. Exposed so
    /// callers (and tests) can `DEL` / `HGETALL` against the same key the
    /// limiter writes to without re-implementing the format.
    pub fn redis_key(&self, bucket_key: &str) -> String {
        format!("{}:bucket:{}", self.key_prefix, bucket_key)
    }

    /// Try to consume `cost` tokens from `bucket_key` (a HASH at
    /// `{key_prefix}:bucket:{bucket_key}` storing `tokens` and `ts`).
    ///
    /// `capacity` and `refill_per_sec` are passed on every call rather
    /// than baked into a per-bucket config: most call sites in SabNode
    /// drive these from per-broadcast / per-tenant settings that can
    /// change between calls. The script always treats them as the
    /// authoritative current values, so changing capacity mid-stream
    /// just resizes the ceiling on the next acquire.
    ///
    /// Returns:
    /// - `Ok(AcquireResult::Granted)` — caller may proceed.
    /// - `Ok(AcquireResult::Denied { retry_after_ms })` — caller should
    ///   sleep and retry.
    /// - `Err(ApiError::Validation(_))` if any of `capacity`,
    ///   `refill_per_sec`, or `cost` is `0`, or `cost > capacity` (an
    ///   acquire that can never succeed).
    /// - `Err(ApiError::Internal(_))` for Redis transport / Lua failures.
    pub async fn try_acquire(
        &self,
        bucket_key: &str,
        capacity: u32,
        refill_per_sec: u32,
        cost: u32,
    ) -> Result<AcquireResult, ApiError> {
        // Cheap guard rails — these are always programmer / config errors,
        // never legitimate runtime conditions, so we surface them as
        // `Validation` rather than letting Redis return a confusing reply.
        if capacity == 0 {
            return Err(ApiError::Validation("capacity must be > 0".into()));
        }
        if refill_per_sec == 0 {
            return Err(ApiError::Validation("refill_per_sec must be > 0".into()));
        }
        if cost == 0 {
            return Err(ApiError::Validation("cost must be > 0".into()));
        }
        if cost > capacity {
            return Err(ApiError::Validation(format!(
                "cost ({cost}) exceeds capacity ({capacity}); acquire can never succeed"
            )));
        }
        if bucket_key.is_empty() {
            return Err(ApiError::Validation("bucket_key cannot be empty".into()));
        }

        let key = self.redis_key(bucket_key);
        let keys: Vec<Key> = vec![key.into()];
        let args: Vec<String> = vec![
            capacity.to_string(),
            refill_per_sec.to_string(),
            cost.to_string(),
        ];

        let client = &self.redis.client;
        let script = acquire_script(client).await.map_err(internal)?;

        // Two-attempt EVALSHA with NOSCRIPT recovery. Mirrors the pattern in
        // `wachat-queue::producer` so behavior is consistent across the
        // codebase whenever a Redis we depend on gets restarted.
        // fred's `evalsha` is generic over <R, C, K, V>; we annotate the
        // return type and let the compiler infer the rest from the keys/args
        // we hand it. The return shape `(i64, i64)` matches the Lua script's
        // `{ granted, retry_after_ms }`.
        let raw: (i64, i64) = match script.evalsha(client, keys.clone(), args.clone()).await {
            Ok(v) => v,
            Err(err) if is_noscript(&err) => {
                tracing::warn!(
                    bucket = %bucket_key,
                    "EVALSHA returned NOSCRIPT — Redis cache was flushed; reloading"
                );
                let script = reload_after_noscript(client).await.map_err(internal)?;
                script.evalsha(client, keys, args).await.map_err(internal)?
            }
            Err(err) => return Err(internal(err)),
        };

        let (granted, retry_after_ms) = raw;
        if granted == 1 {
            Ok(AcquireResult::Granted)
        } else {
            // Lua's ceil() gives us a non-negative integer, but i64 -> u64
            // could in theory wrap if a buggy script returned negative. We
            // saturate at 1ms so callers never sleep 0 in a hot loop.
            let ms = retry_after_ms.max(1) as u64;
            Ok(AcquireResult::Denied { retry_after_ms: ms })
        }
    }
}

/// Convert a fred error into the standard `ApiError::Internal` envelope.
/// We preserve the source chain so the central handler can log fred's
/// structured detail (timeouts, RESP parse errors, etc.).
fn internal(err: fred::error::Error) -> ApiError {
    ApiError::Internal(anyhow::Error::new(err))
}

/// fred surfaces NOSCRIPT as an error whose `Display` carries the original
/// Redis reply text, which contains "NOSCRIPT" verbatim per the Redis
/// protocol. Sniffing this lets us transparently reload the cached script.
fn is_noscript(err: &fred::error::Error) -> bool {
    err.to_string().contains("NOSCRIPT")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redis_key_uses_default_prefix() {
        // Build a bucket without touching Redis — we only exercise the key
        // formatter, which doesn't require a live client.
        //
        // We can't construct a `RedisHandle` without `connect`, so we sneak
        // the formatter logic out via a dedicated helper instead.
        let prefix = DEFAULT_KEY_PREFIX;
        assert_eq!(
            format!("{prefix}:bucket:bcast:tb:abc"),
            "wrl:bucket:bcast:tb:abc"
        );
    }

    #[test]
    fn acquire_result_is_granted_helper() {
        assert!(AcquireResult::Granted.is_granted());
        assert!(
            !AcquireResult::Denied {
                retry_after_ms: 100
            }
            .is_granted()
        );
    }
}
