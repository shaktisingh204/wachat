//! BullMQ-compatible Redis producer.
//!
//! `BullProducer::add` enqueues a single job using a Redis Lua script and
//! returns the assigned job id. The wire format is compatible with the
//! BullMQ consumer side; see `add_job.lua` for the exact behavior and the
//! list of features intentionally omitted.
//!
//! Threading model: `BullProducer` is `Clone` and cheap (it wraps a
//! `RedisHandle`, which is itself an `Arc` around the fred client). Hand a
//! single instance to any number of Axum handlers — there is no internal
//! state that needs serialization beyond the global script cache.

use sabnode_common::ApiError;
use serde::{Deserialize, Serialize};
use serde_json::json;

use sabnode_db::redis::RedisHandle;

use crate::error::QueueError;
use crate::keys;
use crate::script::add_job_script;

/// Default key prefix BullMQ uses (`bull:{queue}:...`). Held as a `String`
/// because tenants occasionally run with a custom prefix (e.g. shard
/// hash-tag) and we want a single struct field rather than two code paths.
pub const DEFAULT_PREFIX: &str = "bull";

/// Job id returned by the producer. BullMQ ids are strings on the wire even
/// when the underlying counter is numeric — we mirror that.
pub type JobId = String;

/// Backoff strategy attached to job options. Encoded into the `opts` JSON
/// blob exactly the way BullMQ writes it, so the Node Worker's retry logic
/// honours it on failure without any consumer-side change.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Backoff {
    /// Fixed delay between attempts (`{ type: 'fixed', delay: ms }`).
    Fixed {
        /// Milliseconds to wait before each retry.
        #[serde(rename = "delay")]
        delay_ms: u64,
    },
    /// Exponential back-off seeded by `delay_ms`
    /// (`{ type: 'exponential', delay: ms }`).
    Exponential {
        /// Base delay in milliseconds. BullMQ multiplies by `2^attempt`.
        #[serde(rename = "delay")]
        delay_ms: u64,
    },
}

impl Default for Backoff {
    /// Mirrors `defaultJobOptions.backoff` on `broadcast-control` so a Rust
    /// producer that doesn't override defaults behaves identically to the
    /// existing Node producer (`{ type: 'exponential', delay: 5000 }`).
    fn default() -> Self {
        Backoff::Exponential { delay_ms: 5_000 }
    }
}

/// Per-job options. Field set covers everything the existing TS callers
/// (`broadcast-queue.ts`, `queue.js`) actually pass — anything missing here
/// is something we decided not to implement yet (see add_job.lua).
#[derive(Debug, Clone)]
pub struct JobOptions {
    /// Delay before the job becomes ready, in ms. `None` enqueues
    /// immediately into the wait list.
    pub delay_ms: Option<u64>,
    /// Maximum attempts (incl. the first). BullMQ default is 1; the
    /// existing TS producers use 3–5 — we pick 3 as a sensible middle.
    pub attempts: u32,
    /// Retry strategy applied between attempts.
    pub backoff: Backoff,
    /// Stable id for dedupe. When `Some` the producer is a no-op if a job
    /// with this id already exists — used by the broadcast queue to make
    /// the server action retry-safe (`jobId: bcast_<id>`).
    pub job_id: Option<String>,
    /// Lower number = higher priority. `None` means FIFO via wait list.
    pub priority: Option<u32>,
}

impl Default for JobOptions {
    fn default() -> Self {
        // 3 attempts + exponential is the most common defaultJobOptions
        // shape across the existing queues. Anything else needs to be
        // explicit at the call site.
        Self {
            delay_ms: None,
            attempts: 3,
            backoff: Backoff::default(),
            job_id: None,
            priority: None,
        }
    }
}

/// Cheap, cloneable BullMQ producer.
///
/// All fields are public for ergonomic construction in tests and binaries
/// that already own a `RedisHandle`. Production code should call
/// `BullProducer::new` so the prefix default is centralised.
#[derive(Clone)]
pub struct BullProducer {
    /// Shared fred client; cloned freely.
    pub redis: RedisHandle,
    /// Key prefix — defaults to `"bull"` to match BullMQ.
    pub prefix: String,
}

impl BullProducer {
    /// Build a producer using the BullMQ default prefix (`bull`). Use
    /// `with_prefix` if you need a custom one (sharded deployments).
    pub fn new(redis: RedisHandle) -> Self {
        Self {
            redis,
            prefix: DEFAULT_PREFIX.to_owned(),
        }
    }

    /// Override the key prefix. Useful for sharded Redis or for namespacing
    /// test runs.
    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.prefix = prefix.into();
        self
    }

    /// Enqueue a single job. Returns the job id assigned by the server (or
    /// the existing id if a `JobOptions::job_id` collision was detected).
    ///
    /// Errors:
    ///   * `ApiError::Validation` for an empty `queue` / `name`.
    ///   * `ApiError::Internal` wrapping `QueueError::Encode` if the
    ///     payload doesn't serialize.
    ///   * `ApiError::Internal` wrapping `QueueError::Redis` for connection
    ///     / protocol failures.
    ///   * `ApiError::Internal` wrapping `QueueError::ScriptFailed` if the
    ///     Lua reply is not a string id.
    pub async fn add<T: Serialize>(
        &self,
        queue: &str,
        name: &str,
        data: &T,
        opts: JobOptions,
    ) -> Result<JobId, ApiError> {
        // Fail fast on the obvious nonsense — a queue or job name with a
        // colon would get silently mis-routed because BullMQ joins on `:`.
        // The Node side has no validation either, so this is a Rust-side
        // hardening measure rather than a compatibility constraint.
        if queue.is_empty() {
            return Err(ApiError::Validation("queue name cannot be empty".into()));
        }
        if name.is_empty() {
            return Err(ApiError::Validation("job name cannot be empty".into()));
        }

        let payload = serde_json::to_string(data).map_err(QueueError::from)?;
        let opts_json = serialize_opts(&opts).map_err(QueueError::from)?;

        // BullMQ's `timestamp` is the producer's wall clock at enqueue
        // time. We use `Utc::now` so callers don't have to plumb a clock
        // through — the consumer side treats it as opaque metadata.
        let timestamp = chrono::Utc::now().timestamp_millis();
        let delay = opts.delay_ms.unwrap_or(0);
        let priority = opts.priority.unwrap_or(0);
        let job_id_arg = opts.job_id.clone().unwrap_or_default();

        // When the caller supplied a custom jobId we can compute the hash
        // key now; otherwise the script will INCR the counter and rebuild
        // it server-side. We still pass *something* in KEYS[1] because
        // Redis Cluster routes by the first key; using the queue's own ID
        // counter key in the auto-id case keeps everything in the same
        // hash slot for cluster deployments using brace-tagged prefixes.
        let job_key_for_keys = if job_id_arg.is_empty() {
            keys::id_counter_key(&self.prefix, queue)
        } else {
            keys::job_key(&self.prefix, queue, &job_id_arg)
        };

        let key_prefix_arg = keys::queue_prefix(&self.prefix, queue);

        // KEYS[N] order MUST match the indices documented at the top of
        // `add_job.lua` — keep these two lists synchronised by hand if
        // you ever extend the script. Comments next to each entry call
        // out the corresponding KEYS[N].
        let lua_keys: Vec<String> = vec![
            job_key_for_keys,                                // KEYS[1]
            keys::wait_key(&self.prefix, queue),             // KEYS[2]
            keys::delayed_key(&self.prefix, queue),          // KEYS[3]
            keys::prioritized_key(&self.prefix, queue),      // KEYS[4]
            keys::meta_key(&self.prefix, queue),             // KEYS[5]
            keys::events_key(&self.prefix, queue),           // KEYS[6]
            keys::marker_key(&self.prefix, queue),           // KEYS[7]
            keys::id_counter_key(&self.prefix, queue),       // KEYS[8]
            keys::priority_counter_key(&self.prefix, queue), // KEYS[9]
        ];

        // ARGV[N] order — see the top of `add_job.lua`.
        let lua_args: Vec<String> = vec![
            job_id_arg,            // ARGV[1] custom jobId or ""
            key_prefix_arg,        // ARGV[2] `{prefix}:{queue}:`
            name.to_owned(),       // ARGV[3] job name
            payload,               // ARGV[4] JSON data
            opts_json,             // ARGV[5] JSON opts
            timestamp.to_string(), // ARGV[6] now-ms
            delay.to_string(),     // ARGV[7] delay ms
            priority.to_string(),  // ARGV[8] priority
        ];

        // `evalsha_with_reload` is fred's built-in NOSCRIPT recovery: it
        // tries EVALSHA, and on `NOSCRIPT` it does a SCRIPT LOAD and
        // retries once. Saves us writing the same dance by hand.
        let script = add_job_script();
        let id: String = script
            .evalsha_with_reload(&self.redis.client, lua_keys, lua_args)
            .await
            .map_err(QueueError::from)?;

        Ok(id)
    }
}

/// Encode `JobOptions` into the JSON shape BullMQ writes to the `opts`
/// hash field. We serialize manually rather than `#[derive(Serialize)]`
/// because BullMQ uses short keys (`attempts`, `delay`, `priority`,
/// `backoff`, `jobId`) and skips fields that are at their default — the
/// Worker's `Job#fromRedis` is permissive, but matching the exact wire
/// format keeps the Redis dump diffable against a Node-produced job.
fn serialize_opts(opts: &JobOptions) -> Result<String, serde_json::Error> {
    // `serde_json::Map` preserves insertion order for stable diffs in tests.
    let mut map = serde_json::Map::new();
    map.insert("attempts".into(), json!(opts.attempts));

    if let Some(delay) = opts.delay_ms {
        map.insert("delay".into(), json!(delay));
    }
    if let Some(priority) = opts.priority {
        map.insert("priority".into(), json!(priority));
    }
    if let Some(jid) = &opts.job_id {
        map.insert("jobId".into(), json!(jid));
    }
    map.insert("backoff".into(), serde_json::to_value(&opts.backoff)?);

    serde_json::to_string(&serde_json::Value::Object(map))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opts_serialize_in_bullmq_shape() {
        let opts = JobOptions {
            delay_ms: Some(2_500),
            attempts: 5,
            backoff: Backoff::Exponential { delay_ms: 5_000 },
            job_id: Some("bcast_42".into()),
            priority: Some(1_000),
        };
        let s = serialize_opts(&opts).unwrap();

        // Field-by-field assertions instead of an exact string match — the
        // important property is that the consumer's Job#fromRedis sees
        // the keys it expects, not the precise byte layout.
        let v: serde_json::Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["attempts"], 5);
        assert_eq!(v["delay"], 2_500);
        assert_eq!(v["priority"], 1_000);
        assert_eq!(v["jobId"], "bcast_42");
        assert_eq!(v["backoff"]["type"], "exponential");
        assert_eq!(v["backoff"]["delay"], 5_000);
    }

    #[test]
    fn default_opts_omit_optional_fields() {
        let s = serialize_opts(&JobOptions::default()).unwrap();
        let v: serde_json::Value = serde_json::from_str(&s).unwrap();
        // `attempts` and `backoff` are always present; the optional fields
        // are not, so a default-options job's hash doesn't carry stale
        // priority/delay keys.
        assert_eq!(v["attempts"], 3);
        assert!(v.get("delay").is_none());
        assert!(v.get("priority").is_none());
        assert!(v.get("jobId").is_none());
    }
}
