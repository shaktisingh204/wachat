//! Redis dispatcher worker loop — Track B Phase 2 sub-task #3.
//!
//! Single-worker loop that claims jobs from a BullMQ-shape Redis queue and
//! hands them to a phase-3-owned `ExecutorHandler`. Key contract points
//! (per `docs/adr/sabflow-executor-n8n-survey.md` §4 and the Phase 2 queue
//! schema ADR):
//!
//! * `sabflow:queue:<name>:wait` — list of job ids ready to run (`LPUSH`/`RPOP`).
//! * `sabflow:queue:<name>:active` — list of ids currently held by a worker.
//! * `sabflow:queue:<name>:completed` — most-recent N successful ids (capped).
//! * `sabflow:queue:<name>:failed` — terminally failed ids.
//! * `sabflow:queue:<name>:<jobId>` — HASH carrying the job fields
//!   (`data`, `opts`, `attemptsMade`, `maxTries`, `processedOn`, `finishedOn`,
//!   `returnvalue`, `failedReason`, …).
//! * `sabflow:queue:<name>:<jobId>:lock` — SETNX-guarded lock string,
//!   value is the worker id, TTL `LOCK_TTL_SECS`.
//!
//! ## Claim protocol (atomic, via Lua)
//!
//! 1. `BRPOPLPUSH wait active 1` blocks up to 1 s, returns a job id or nil.
//! 2. On hit: the Lua script in [`CLAIM_LUA`] performs `SETNX` on the lock
//!    key and `HGETALL` on the job hash inside one Redis round-trip so a
//!    second worker that just popped the same id (impossible under
//!    BRPOPLPUSH, but defensive against future fan-out) cannot also win
//!    the lock.
//! 3. The dispatcher spawns a heartbeat task that `PEXPIRE`s the lock every
//!    `HEARTBEAT_INTERVAL_SECS` so a long-running job doesn't get reclaimed
//!    by the stalled-job monitor (sibling #6).
//!
//! ## Execution & finalisation
//!
//! The decoded [`Job`] is handed to a forward-declared [`ExecutorHandler`]
//! trait (Phase 3 owns the implementation; this crate intentionally does
//! **not** implement it). Based on the handler's `Result`:
//!
//! * Success — `HSET finishedOn returnvalue` on the job hash,
//!   `LREM active 1 <id>`, `LPUSH completed <id>` and `LTRIM completed 0 999`
//!   (the cap protects Redis memory; sibling #7 will widen this to an
//!   archive collection).
//! * Error — `HSET failedReason`; if `attemptsMade + 1 < maxTries`,
//!   sibling #5 owns the backoff re-enqueue (delegated via the
//!   `BackoffPolicy` hook below); otherwise move to `failed`.
//!
//! ## Shutdown
//!
//! Sibling #8 owns the global signal handler; the dispatcher takes a
//! `CancellationToken` and aborts mid-`BRPOPLPUSH` via `tokio::select!`.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::task::JoinHandle;
use tokio::time;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

/// Lock TTL for an actively-running job. Heartbeat refreshes at half this.
const LOCK_TTL_SECS: u64 = 30;
/// Heartbeat refresh interval — well under [`LOCK_TTL_SECS`].
const HEARTBEAT_INTERVAL_SECS: u64 = 10;
/// `BRPOPLPUSH` block window. Short so shutdown is responsive.
const CLAIM_BLOCK_SECS: usize = 1;
/// Cap on the `completed` list, per the task spec.
const COMPLETED_CAP: isize = 1000;

/// Atomic claim: `SETNX` the lock and `HGETALL` the job hash in one round-trip.
///
/// KEYS[1] = lock key (`sabflow:queue:<name>:<jobId>:lock`)
/// KEYS[2] = job hash key (`sabflow:queue:<name>:<jobId>`)
/// ARGV[1] = worker id (lock value)
/// ARGV[2] = lock TTL in seconds
///
/// Returns:
///   * `{1, <flat hash kv pairs>}` on lock-acquired
///   * `{0}` if another worker already holds the lock (race lost; the
///     caller must put the id back on `wait` since we already popped it).
pub const CLAIM_LUA: &str = r#"
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[2])) then
  local hash = redis.call('HGETALL', KEYS[2])
  return {1, hash}
else
  return {0}
end
"#;

// ---------------------------------------------------------------------------
// Forward-declared executor handler (Phase 3 owns the impl).
// ---------------------------------------------------------------------------

/// Forward-declared trait the dispatcher hands claimed jobs to. Phase 3
/// owns the concrete implementation (the `WorkflowExecute`-equivalent
/// driver living in `sabflow-executor-core`); this crate is intentionally
/// generic over it so the queue can be tested without booting the engine.
#[async_trait]
pub trait ExecutorHandler: Send + Sync + 'static {
    /// Run a single job to terminal success/failure. The returned JSON value
    /// (if any) is stored on the job hash under `returnvalue`.
    async fn run_execution(&self, job: Job) -> Result<serde_json::Value, ExecutorError>;
}

/// Forward-declared backoff hook — sibling #5 owns the policy. The
/// dispatcher only calls `delay_for_attempt`; on `None` it means "no more
/// retries, push to failed".
pub trait BackoffPolicy: Send + Sync + 'static {
    fn delay_for_attempt(&self, attempts_made: u32, max_tries: u32) -> Option<Duration>;
}

/// Error type the executor surfaces to the dispatcher. Variants are
/// intentionally shallow — Phase 3 widens this once `NodeApiError` /
/// `NodeOperationError` (see `sabflow-executor-errors` crate) are landed.
#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("node execution failed: {0}")]
    Node(String),
    #[error("execution timed out")]
    Timeout,
    #[error("execution cancelled")]
    Cancelled,
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// ---------------------------------------------------------------------------
// Job — deserialised from the BullMQ HASH per the Phase 2 queue schema ADR.
// ---------------------------------------------------------------------------

/// Job claimed off the wait list. Fields mirror the BullMQ HASH shape:
/// `data` is a JSON-encoded string (the execution payload); numeric fields
/// arrive as decimal strings; absent fields default sensibly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    /// Workflow execution payload — `serde_json::from_str(&job.data)` to
    /// recover the canonical execution document (sibling #1's `Job.data`).
    pub data: String,
    /// BullMQ-shape options blob; opaque at this layer, parsed by the
    /// retry policy & by Phase-3 execution as needed.
    #[serde(default)]
    pub opts: String,
    #[serde(default)]
    pub attempts_made: u32,
    /// Mirrors BullMQ `opts.attempts`; falls back to 1 (no retry) when absent.
    #[serde(default = "default_max_tries")]
    pub max_tries: u32,
    #[serde(default)]
    pub timestamp: Option<i64>,
    #[serde(default)]
    pub processed_on: Option<i64>,
}

fn default_max_tries() -> u32 {
    1
}

impl Job {
    /// Parse a BullMQ HASH (flat `[k, v, k, v, ...]` list as returned by
    /// `HGETALL`) into a `Job`. Unknown fields are ignored so the schema
    /// can evolve without breaking older workers.
    pub fn from_hash(id: String, hash: Vec<String>) -> Result<Self, DispatcherError> {
        if !hash.len().is_multiple_of(2) {
            return Err(DispatcherError::JobMalformed(
                "HGETALL returned odd number of fields".into(),
            ));
        }
        let mut map: HashMap<String, String> = HashMap::with_capacity(hash.len() / 2);
        let mut it = hash.into_iter();
        while let (Some(k), Some(v)) = (it.next(), it.next()) {
            map.insert(k, v);
        }
        let data = map.remove("data").unwrap_or_default();
        let opts = map.remove("opts").unwrap_or_default();
        let attempts_made: u32 = map
            .remove("attemptsMade")
            .as_deref()
            .map(str::parse)
            .transpose()
            .map_err(|e: std::num::ParseIntError| {
                DispatcherError::JobMalformed(format!("attemptsMade: {e}"))
            })?
            .unwrap_or(0);
        // `opts` is a JSON blob; sibling #5 unpacks `attempts` from it. We
        // accept either a top-level `maxTries` HASH field (Sabflow-native)
        // or a parsed `attempts` out of the `opts` JSON.
        let max_tries: u32 = map
            .remove("maxTries")
            .as_deref()
            .map(str::parse)
            .transpose()
            .map_err(|e: std::num::ParseIntError| {
                DispatcherError::JobMalformed(format!("maxTries: {e}"))
            })?
            .or_else(|| {
                serde_json::from_str::<serde_json::Value>(&opts)
                    .ok()
                    .and_then(|v| v.get("attempts").and_then(|a| a.as_u64()))
                    .map(|n| n as u32)
            })
            .unwrap_or_else(default_max_tries);
        let timestamp = map
            .remove("timestamp")
            .as_deref()
            .map(str::parse)
            .transpose()
            .ok()
            .flatten();
        let processed_on = map
            .remove("processedOn")
            .as_deref()
            .map(str::parse)
            .transpose()
            .ok()
            .flatten();
        Ok(Self {
            id,
            data,
            opts,
            attempts_made,
            max_tries,
            timestamp,
            processed_on,
        })
    }
}

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum DispatcherError {
    #[error(transparent)]
    Redis(#[from] redis::RedisError),
    #[error("job hash malformed: {0}")]
    JobMalformed(String),
    #[error("lock race lost for job {0}")]
    LockLost(String),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------

/// Single-worker dispatcher. One instance per worker process; multiple
/// processes can share the same `queue_name` safely (the Lua claim
/// guarantees one-worker-per-job).
pub struct Dispatcher {
    pub redis: redis::Client,
    pub queue_name: String,
    pub worker_id: String,
    pub shutdown: CancellationToken,
    handler: Arc<dyn ExecutorHandler>,
}

impl Dispatcher {
    /// Build a dispatcher. The handler is taken as a constructor arg so
    /// Phase 3 (and tests) can inject any `ExecutorHandler` impl without
    /// this crate growing an engine dep.
    pub fn new(
        redis: redis::Client,
        queue_name: impl Into<String>,
        worker_id: impl Into<String>,
        shutdown: CancellationToken,
        handler: Arc<dyn ExecutorHandler>,
    ) -> Self {
        Self {
            redis,
            queue_name: queue_name.into(),
            worker_id: worker_id.into(),
            shutdown,
            handler,
        }
    }

    fn wait_key(&self) -> String {
        format!("sabflow:queue:{}:wait", self.queue_name)
    }
    fn active_key(&self) -> String {
        format!("sabflow:queue:{}:active", self.queue_name)
    }
    fn completed_key(&self) -> String {
        format!("sabflow:queue:{}:completed", self.queue_name)
    }
    fn failed_key(&self) -> String {
        format!("sabflow:queue:{}:failed", self.queue_name)
    }
    fn job_key(&self, id: &str) -> String {
        format!("sabflow:queue:{}:{}", self.queue_name, id)
    }
    fn lock_key(&self, id: &str) -> String {
        format!("sabflow:queue:{}:{}:lock", self.queue_name, id)
    }

    /// Main worker loop. Runs until `shutdown` fires or an unrecoverable
    /// Redis error bubbles up. Per-job failures are logged and the loop
    /// continues.
    pub async fn run(&self) -> anyhow::Result<()> {
        info!(
            worker_id = %self.worker_id,
            queue = %self.queue_name,
            "dispatcher: starting"
        );
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let wait_key = self.wait_key();
        let active_key = self.active_key();

        loop {
            if self.shutdown.is_cancelled() {
                info!(worker_id = %self.worker_id, "dispatcher: shutdown observed, exiting loop");
                break;
            }

            // BRPOPLPUSH wait → active with 1 s timeout. Race the shutdown
            // token so we can abort mid-block.
            let popped: Option<String> = tokio::select! {
                _ = self.shutdown.cancelled() => {
                    info!(worker_id = %self.worker_id, "dispatcher: cancelled during BRPOPLPUSH");
                    break;
                }
                res = brpoplpush(&mut conn, &wait_key, &active_key, CLAIM_BLOCK_SECS) => {
                    match res {
                        Ok(v) => v,
                        Err(e) => {
                            warn!(error = %e, "dispatcher: BRPOPLPUSH error, retrying after backoff");
                            time::sleep(Duration::from_millis(500)).await;
                            continue;
                        }
                    }
                }
            };

            let Some(job_id) = popped else {
                continue;
            };

            if let Err(e) = self.handle_one(&mut conn, &job_id).await {
                error!(job_id = %job_id, error = %e, "dispatcher: handle_one failed");
            }
        }

        info!(worker_id = %self.worker_id, "dispatcher: stopped");
        Ok(())
    }

    /// Claim, execute, and finalise a single job. Errors here are logged
    /// by the caller; this method never panics on a per-job failure.
    async fn handle_one(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        job_id: &str,
    ) -> Result<(), DispatcherError> {
        let lock_key = self.lock_key(job_id);
        let job_key = self.job_key(job_id);

        // Atomic SETNX lock + HGETALL via Lua.
        let script = redis::Script::new(CLAIM_LUA);
        let claim: (i64, Option<Vec<String>>) = script
            .key(&lock_key)
            .key(&job_key)
            .arg(&self.worker_id)
            .arg(LOCK_TTL_SECS)
            .invoke_async(conn)
            .await?;

        let (acquired, hash) = claim;
        if acquired != 1 {
            // Another worker already holds the lock. Put the id back on
            // `wait` and bail — we already RPOPLPUSH'd it onto active, so
            // also strip it off active to keep the lists consistent.
            warn!(job_id = %job_id, "dispatcher: lock race lost, returning id to wait");
            let _: i64 = conn.lrem(self.active_key(), 1, job_id).await.unwrap_or(0);
            let _: () = conn.lpush(self.wait_key(), job_id).await.unwrap_or(());
            return Err(DispatcherError::LockLost(job_id.to_string()));
        }

        let hash = hash.unwrap_or_default();
        let job = Job::from_hash(job_id.to_string(), hash)?;
        debug!(job_id = %job_id, attempts_made = job.attempts_made, max_tries = job.max_tries, "dispatcher: claimed");

        // Spawn a heartbeat task; cancel it as soon as the handler returns.
        let heartbeat_cancel = CancellationToken::new();
        let heartbeat = spawn_heartbeat(
            self.redis.clone(),
            lock_key.clone(),
            self.worker_id.clone(),
            heartbeat_cancel.clone(),
        );

        let exec_result = self.handler.run_execution(job.clone()).await;
        heartbeat_cancel.cancel();
        let _ = heartbeat.await;

        match exec_result {
            Ok(ret) => self.on_success(conn, job_id, &ret).await?,
            Err(e) => self.on_failure(conn, &job, &e).await?,
        }

        // Lock is auto-released on TTL; explicit DEL is best-effort.
        let _: i64 = conn.del(&lock_key).await.unwrap_or(0);
        Ok(())
    }

    async fn on_success(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        job_id: &str,
        ret: &serde_json::Value,
    ) -> Result<(), DispatcherError> {
        let now_ms = now_millis();
        let ret_str = serde_json::to_string(ret).unwrap_or_else(|_| "null".into());
        // HSET finishedOn + returnvalue.
        let _: () = redis::pipe()
            .atomic()
            .hset(self.job_key(job_id), "finishedOn", now_ms)
            .hset(self.job_key(job_id), "returnvalue", &ret_str)
            .lrem(self.active_key(), 1, job_id)
            .lpush(self.completed_key(), job_id)
            .ltrim(self.completed_key(), 0, COMPLETED_CAP - 1)
            .query_async(conn)
            .await?;
        debug!(job_id = %job_id, "dispatcher: finalised success");
        Ok(())
    }

    async fn on_failure(
        &self,
        conn: &mut redis::aio::MultiplexedConnection,
        job: &Job,
        err: &ExecutorError,
    ) -> Result<(), DispatcherError> {
        let reason = err.to_string();
        let _: () = conn
            .hset(self.job_key(&job.id), "failedReason", &reason)
            .await?;
        let next_attempt = job.attempts_made.saturating_add(1);
        let _: () = conn
            .hset(self.job_key(&job.id), "attemptsMade", next_attempt)
            .await?;

        if next_attempt < job.max_tries {
            // Sibling #5 owns the backoff schedule (delayed-set / Z-set
            // re-enqueue). We mark the intent here so its monitor picks it
            // up — strip from active, push back on wait with no delay as a
            // safe fallback when the policy crate isn't wired in yet.
            warn!(
                job_id = %job.id,
                attempts_made = next_attempt,
                max_tries = job.max_tries,
                reason = %reason,
                "dispatcher: re-enqueuing (sibling #5 owns backoff)"
            );
            let _: () = redis::pipe()
                .atomic()
                .lrem(self.active_key(), 1, &job.id)
                .lpush(self.wait_key(), &job.id)
                .query_async(conn)
                .await?;
        } else {
            warn!(
                job_id = %job.id,
                attempts_made = next_attempt,
                max_tries = job.max_tries,
                reason = %reason,
                "dispatcher: terminal failure, moving to failed list"
            );
            let _: () = redis::pipe()
                .atomic()
                .lrem(self.active_key(), 1, &job.id)
                .lpush(self.failed_key(), &job.id)
                .query_async(conn)
                .await?;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Heartbeat task.
// ---------------------------------------------------------------------------

/// Refresh the lock TTL every [`HEARTBEAT_INTERVAL_SECS`] until cancelled.
/// Uses a `SET … XX KEEPTTL`-style guard: only refresh if we still own the
/// lock (value == our worker id), so a stalled-job monitor that already
/// stole the lock won't be silently re-extended.
fn spawn_heartbeat(
    client: redis::Client,
    lock_key: String,
    worker_id: String,
    cancel: CancellationToken,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        // Lua guard: only EXPIRE if the lock value still matches ours.
        const REFRESH_LUA: &str = r#"
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
else
  return 0
end
"#;
        let mut conn = match client.get_multiplexed_async_connection().await {
            Ok(c) => c,
            Err(e) => {
                warn!(error = %e, lock_key = %lock_key, "heartbeat: failed to open conn");
                return;
            }
        };
        let script = redis::Script::new(REFRESH_LUA);
        let mut tick = time::interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));
        // Skip the immediate tick; the claim just set the TTL.
        tick.tick().await;
        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    debug!(lock_key = %lock_key, "heartbeat: cancelled");
                    break;
                }
                _ = tick.tick() => {
                    let res: Result<i64, redis::RedisError> = script
                        .key(&lock_key)
                        .arg(&worker_id)
                        .arg(LOCK_TTL_SECS)
                        .invoke_async(&mut conn)
                        .await;
                    match res {
                        Ok(1) => {
                            debug!(lock_key = %lock_key, "heartbeat: refreshed");
                        }
                        Ok(_) => {
                            warn!(lock_key = %lock_key, "heartbeat: lock no longer ours, stopping");
                            break;
                        }
                        Err(e) => {
                            warn!(error = %e, lock_key = %lock_key, "heartbeat: refresh failed");
                        }
                    }
                }
            }
        }
    })
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

async fn brpoplpush(
    conn: &mut redis::aio::MultiplexedConnection,
    src: &str,
    dst: &str,
    timeout_secs: usize,
) -> Result<Option<String>, redis::RedisError> {
    // `BRPOPLPUSH` is deprecated in Redis ≥ 6.2 in favour of `BLMOVE`, but
    // the semantics (and the BullMQ wire shape) are identical. The `redis`
    // crate exposes both via `cmd()`; using the raw command keeps us
    // compatible across the Redis versions SabFlow's Phase 2 ADR supports.
    let res: redis::Value = redis::cmd("BRPOPLPUSH")
        .arg(src)
        .arg(dst)
        .arg(timeout_secs)
        .query_async(conn)
        .await?;
    match res {
        redis::Value::Nil => Ok(None),
        redis::Value::BulkString(bytes) => Ok(Some(String::from_utf8_lossy(&bytes).into_owned())),
        // Older redis-rs versions name it `Data`.
        other => {
            // Try to coerce via FromRedisValue as a fallback.
            let s: Option<String> = redis::FromRedisValue::from_redis_value(&other).ok();
            Ok(s)
        }
    }
}

fn now_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_from_hash_parses_minimum_fields() {
        let hash = vec![
            "data".into(),
            "{\"hello\":\"world\"}".into(),
            "attemptsMade".into(),
            "2".into(),
            "maxTries".into(),
            "5".into(),
        ];
        let job = Job::from_hash("job-1".into(), hash).expect("parse");
        assert_eq!(job.id, "job-1");
        assert_eq!(job.attempts_made, 2);
        assert_eq!(job.max_tries, 5);
        assert_eq!(job.data, "{\"hello\":\"world\"}");
    }

    #[test]
    fn job_from_hash_pulls_max_tries_from_opts_when_absent() {
        let hash = vec![
            "data".into(),
            "{}".into(),
            "opts".into(),
            "{\"attempts\":7}".into(),
        ];
        let job = Job::from_hash("job-2".into(), hash).expect("parse");
        assert_eq!(job.max_tries, 7);
        assert_eq!(job.attempts_made, 0);
    }

    #[test]
    fn job_from_hash_rejects_odd_length() {
        let hash = vec!["data".into(), "{}".into(), "stray".into()];
        let err = Job::from_hash("job-3".into(), hash).unwrap_err();
        match err {
            DispatcherError::JobMalformed(_) => {}
            _ => panic!("expected JobMalformed"),
        }
    }

    #[test]
    fn claim_lua_is_nonempty() {
        // Smoke: the Lua body is non-empty and references the documented
        // KEYS / ARGV slots so a typo doesn't silently ship.
        assert!(CLAIM_LUA.contains("SET"));
        assert!(CLAIM_LUA.contains("HGETALL"));
        assert!(CLAIM_LUA.contains("KEYS[1]"));
        assert!(CLAIM_LUA.contains("KEYS[2]"));
        assert!(CLAIM_LUA.contains("ARGV[1]"));
        assert!(CLAIM_LUA.contains("ARGV[2]"));
    }
}
