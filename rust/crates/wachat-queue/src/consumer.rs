//! BullMQ-compatible Redis **consumer** (`Worker`).
//!
//! Companion to [`crate::producer::BullProducer`]. Where the producer
//! writes the job hash + queue list/zset entries in the BullMQ wire shape,
//! the consumer reads jobs back, runs a user-supplied [`JobHandler`], and
//! reports completion / failure to Redis the same way a Node BullMQ
//! `Worker` would.
//!
//! ## What it does
//!
//! Spawns a single async task driving the `wait → active → completed/
//! failed/delayed` state machine for one queue. Per-job lock renewal,
//! retry/backoff, and stalled-job recovery are handled by background
//! tasks that the worker owns; callers only need to implement
//! [`JobHandler::process`].
//!
//! ## Threading model
//!
//! [`Worker`] owns its background state and is consumed by
//! [`Worker::run`]. Hand a single instance to one [`tokio::spawn`] call
//! and use [`CloseHandle`] (returned by [`Worker::close_handle`]) to
//! signal shutdown. The handler itself is shared as `Arc<dyn JobHandler>`
//! and can be cloned freely; `process` must be `Send + Sync` so the
//! consumer can call it from any tokio worker thread.
//!
//! ## BullMQ-compat caveats
//!
//! See `move_to_active.lua`, `move_to_completed.lua`,
//! `move_to_failed.lua`, and `stalled_check.lua` for line-by-line
//! deviations from upstream. In one sentence: we replicate the observable
//! key/state transitions BullMQ's worker writes to Redis, but skip rate
//! limit groups, `FlowProducer` parents, and BullMQ's internal
//! `addJobInTargetList` complexity.
//!
//! ## Example
//!
//! ```no_run
//! use std::sync::Arc;
//! use serde_json::json;
//! use wachat_queue::{
//!     BullJob, JobHandler, JobOutcome, Worker, WorkerOptions,
//! };
//!
//! struct EchoHandler;
//!
//! #[async_trait::async_trait]
//! impl JobHandler for EchoHandler {
//!     async fn process(&self, job: &BullJob) -> Result<JobOutcome, anyhow::Error> {
//!         tracing::info!(job_id = %job.id, "processing");
//!         Ok(JobOutcome::Completed(json!({ "echoed": job.data.clone() })))
//!     }
//! }
//!
//! # async fn run(redis: sabnode_db::redis::RedisHandle) -> anyhow::Result<()> {
//! let worker = Worker::new(
//!     redis,
//!     "broadcast-control",
//!     Arc::new(EchoHandler),
//!     WorkerOptions::default(),
//! );
//! let close = worker.close_handle();
//!
//! let join = tokio::spawn(async move { worker.run().await });
//!
//! // Later, on SIGTERM:
//! close.shutdown();
//! join.await??;
//! # Ok(()) }
//! ```

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use fred::clients::Client;
use fred::interfaces::KeysInterface;
use fred::types::scripts::Script;
use serde_json::Value;
use tokio::sync::{Notify, Semaphore};
use tokio::task::JoinSet;
use tokio::time::{Instant, sleep};

use sabnode_db::redis::RedisHandle;

use crate::error::QueueError;
use crate::keys;
use crate::producer::{Backoff, DEFAULT_PREFIX};
use crate::script::{
    move_to_active_script, move_to_completed_script, move_to_failed_script, stalled_check_script,
};

/// A job pulled off a BullMQ queue, ready to be processed.
///
/// The shape mirrors BullMQ's `Job` view from a worker's perspective:
/// `data` and `opts` are the *parsed* JSON values that the producer
/// stored as JSON-stringified blobs in the Redis hash. The consumer
/// re-parses on the way out so handlers don't need to keep re-deriving
/// the same `serde_json::Value`s.
#[derive(Debug, Clone)]
pub struct BullJob {
    /// Job id assigned by the producer (custom or auto-incremented).
    pub id: String,
    /// Job name (e.g. `"process-broadcast"`).
    pub name: String,
    /// Caller-supplied payload, as parsed JSON.
    pub data: Value,
    /// `attemptsMade` *before* this attempt — i.e. on the very first
    /// dispatch this is 0.
    pub attempts_made: u32,
    /// Producer's `Date.now()` at enqueue time, in ms since epoch.
    pub timestamp: i64,
    /// Raw bullmq job options (priority, delay, attempts, backoff, etc.) — read-only.
    pub opts: Value,
}

/// Outcome the handler returns. The consumer translates this into a
/// BullMQ `moveToCompleted` / `moveToFailed` (with retry-or-DLQ) call.
#[derive(Debug)]
pub enum JobOutcome {
    /// Mark complete with a JSON return value (stored in the job hash's
    /// `returnvalue` field).
    Completed(Value),
    /// Soft failure. Consumer will retry per the job's `attempts` +
    /// `backoff` opts; once attempts are exhausted, the job moves to
    /// `failed`.
    Failed {
        /// Human-readable failure reason. Stored verbatim as
        /// `failedReason` on the job hash.
        error: String,
    },
}

/// Trait every [`Worker`] is parameterized over.
///
/// Implementers MUST be tolerant of replay (a job may be re-delivered
/// after a worker crash mid-process — the stalled-job sweep will reset
/// its lock and another worker will pick it up). Use [`BullJob::id`] as
/// an idempotency key; do not rely on `attempts_made` to be unique.
#[async_trait]
pub trait JobHandler: Send + Sync + 'static {
    /// Process exactly one job.
    async fn process(&self, job: &BullJob) -> Result<JobOutcome, anyhow::Error>;
}

/// Tunables for the consumer loop. Defaults match the Node BullMQ
/// defaults so swapping a Rust [`Worker`] in for a Node `new Worker(...)`
/// produces identical pacing.
#[derive(Debug, Clone)]
pub struct WorkerOptions {
    /// Max in-flight jobs per worker. Default 16.
    pub concurrency: usize,
    /// Lock duration in ms. The consumer renews the lock every
    /// `lock_renew_ms`. Default 30_000.
    pub lock_duration_ms: u64,
    /// Default 15_000.
    pub lock_renew_ms: u64,
    /// Stalled-job sweep interval in ms. Default 30_000.
    pub stalled_interval_ms: u64,
    /// How many times a job can stall before going to `failed`.
    /// Default 1 (matches BullMQ).
    pub max_stalled_count: u32,
    /// Maximum wait when polling an empty queue, in ms. Default 1_000.
    /// Lower → more responsive; higher → fewer Redis round-trips when
    /// idle. Polling is needed because we don't use BullMQ's blocking
    /// `BRPOPLPUSH` — see top-of-module comment for why.
    pub poll_idle_ms: u64,
    /// Max number of delayed jobs we promote in one `moveToActive`
    /// invocation. Keeps script latency bounded under heavy delayed
    /// load. Default 16.
    pub max_promote_per_call: u32,
    /// `removeOnComplete: { count }` mirror — keeps the most recent N
    /// entries in the `completed` zset. `None` = no count cap.
    pub remove_on_complete_count: Option<u32>,
    /// `removeOnComplete: { age }` mirror in ms. `None` = no age cap.
    pub remove_on_complete_age_ms: Option<u64>,
    /// `removeOnFail: { count }` mirror.
    pub remove_on_fail_count: Option<u32>,
    /// `removeOnFail: { age }` mirror in ms.
    pub remove_on_fail_age_ms: Option<u64>,
}

impl Default for WorkerOptions {
    fn default() -> Self {
        Self {
            concurrency: 16,
            lock_duration_ms: 30_000,
            lock_renew_ms: 15_000,
            stalled_interval_ms: 30_000,
            max_stalled_count: 1,
            poll_idle_ms: 1_000,
            max_promote_per_call: 16,
            remove_on_complete_count: None,
            remove_on_complete_age_ms: None,
            remove_on_fail_count: None,
            remove_on_fail_age_ms: None,
        }
    }
}

/// Cloneable shutdown signal. Hand one to your SIGTERM handler and call
/// [`CloseHandle::shutdown`] when you want the worker loop to drain
/// in-flight jobs and exit.
///
/// Cheap to clone (`Arc<Notify>` + a flag); identical clones share the
/// same shutdown state.
#[derive(Clone, Debug)]
pub struct CloseHandle {
    inner: Arc<CloseInner>,
}

#[derive(Debug)]
struct CloseInner {
    notify: Notify,
    flag: std::sync::atomic::AtomicBool,
}

impl CloseHandle {
    /// Signal the worker to begin graceful shutdown. Idempotent.
    pub fn shutdown(&self) {
        self.inner
            .flag
            .store(true, std::sync::atomic::Ordering::SeqCst);
        // Wake every awaiter — the dispatch loop and any sleeping
        // background task.
        self.inner.notify.notify_waiters();
    }

    /// Returns `true` once `shutdown` has been called.
    pub fn is_shutdown(&self) -> bool {
        self.inner.flag.load(std::sync::atomic::Ordering::SeqCst)
    }

    fn new() -> Self {
        Self {
            inner: Arc::new(CloseInner {
                notify: Notify::new(),
                flag: std::sync::atomic::AtomicBool::new(false),
            }),
        }
    }

    /// Future-style wait — resolves the moment shutdown is signalled.
    /// Used internally by the dispatch loop to break out of polling
    /// sleeps without waiting for a tick to elapse.
    async fn wait(&self) {
        if self.is_shutdown() {
            return;
        }
        self.inner.notify.notified().await;
    }
}

/// BullMQ-compatible consumer for one queue.
///
/// Constructed via [`Worker::new`]; consumed by [`Worker::run`]. See the
/// module-level docs for an end-to-end example.
pub struct Worker {
    redis: RedisHandle,
    queue_name: String,
    prefix: String,
    handler: Arc<dyn JobHandler>,
    opts: WorkerOptions,
    close: CloseHandle,
    /// One token per worker instance, written into every lock key so the
    /// stalled sweep can detect that an old incarnation's lock has
    /// expired. UUIDv4 is plenty for uniqueness.
    token: String,
}

impl std::fmt::Debug for Worker {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Worker")
            .field("queue_name", &self.queue_name)
            .field("prefix", &self.prefix)
            .field("opts", &self.opts)
            .field("token", &self.token)
            .finish_non_exhaustive()
    }
}

impl Worker {
    /// Build a worker bound to a queue. Does not start polling — call
    /// [`Worker::run`].
    ///
    /// Uses the BullMQ default key prefix (`"bull"`); use
    /// [`Worker::with_prefix`] if your deployment overrides it.
    pub fn new(
        redis: RedisHandle,
        queue_name: impl Into<String>,
        handler: Arc<dyn JobHandler>,
        opts: WorkerOptions,
    ) -> Self {
        Self {
            redis,
            queue_name: queue_name.into(),
            prefix: DEFAULT_PREFIX.to_owned(),
            handler,
            opts,
            close: CloseHandle::new(),
            token: uuid::Uuid::new_v4().to_string(),
        }
    }

    /// Override the BullMQ key prefix. Mirrors
    /// [`crate::BullProducer::with_prefix`] so producer + consumer can
    /// share the same configuration.
    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.prefix = prefix.into();
        self
    }

    /// Cloneable handle that signals graceful shutdown. Intended to be
    /// wired to your binary's SIGTERM / SIGINT handler.
    pub fn close_handle(&self) -> CloseHandle {
        self.close.clone()
    }

    /// Run the consumer loop until [`CloseHandle::shutdown`] is signalled.
    /// Returns `Ok(())` on graceful shutdown, `Err` on a fatal Redis
    /// failure that retries couldn't recover from.
    pub async fn run(self) -> Result<(), QueueError> {
        let Worker {
            redis,
            queue_name,
            prefix,
            handler,
            opts,
            close,
            token,
        } = self;

        let semaphore = Arc::new(Semaphore::new(opts.concurrency));
        let mut in_flight: JoinSet<()> = JoinSet::new();

        // Stalled-sweep ticker runs alongside the dispatch loop. We keep
        // it in the same JoinSet so a panic surfaces in `run`.
        let stalled = StalledSweeper {
            redis: redis.clone(),
            queue_name: queue_name.clone(),
            prefix: prefix.clone(),
            opts: opts.clone(),
            close: close.clone(),
        };
        in_flight.spawn(async move {
            stalled.run().await;
        });

        tracing::info!(
            queue = %queue_name,
            token = %token,
            concurrency = opts.concurrency,
            "wachat-queue consumer starting"
        );

        loop {
            if close.is_shutdown() {
                break;
            }

            // Acquire a concurrency permit before pulling a job. This is
            // the moment that bounds in-flight work to `opts.concurrency`.
            let permit = tokio::select! {
                p = semaphore.clone().acquire_owned() => match p {
                    Ok(p) => p,
                    // Semaphore is closed only when we close it; treat
                    // as a shutdown trigger.
                    Err(_) => break,
                },
                _ = close.wait() => break,
            };

            // Try to pull a job off the queue. On idle, sleep
            // poll_idle_ms (or until shutdown).
            let acquired = match move_to_active(
                &redis.client,
                &prefix,
                &queue_name,
                &token,
                opts.lock_duration_ms,
                opts.max_promote_per_call,
            )
            .await
            {
                Ok(v) => v,
                Err(err) => {
                    tracing::warn!(
                        queue = %queue_name,
                        error = %err,
                        "moveToActive failed; backing off"
                    );
                    drop(permit);
                    // Fatal Redis errors (auth, etc.) will surface again
                    // on the next iteration; we apply a short back-off
                    // to avoid hot-spinning a dead Redis.
                    let backoff_until = Instant::now() + Duration::from_millis(opts.poll_idle_ms);
                    tokio::select! {
                        _ = tokio::time::sleep_until(backoff_until) => {},
                        _ = close.wait() => break,
                    }
                    continue;
                }
            };

            let Some(job) = acquired else {
                // Empty queue — wait poll_idle_ms or shutdown.
                drop(permit);
                let until = Instant::now() + Duration::from_millis(opts.poll_idle_ms);
                tokio::select! {
                    _ = tokio::time::sleep_until(until) => {},
                    _ = close.wait() => break,
                }
                continue;
            };

            // Fork off the job. The spawned task owns the permit (it
            // releases on drop) and the lock-renew loop.
            let redis = redis.clone();
            let queue_name = queue_name.clone();
            let prefix = prefix.clone();
            let token = token.clone();
            let handler = handler.clone();
            let opts = opts.clone();

            in_flight.spawn(async move {
                run_one_job(redis, prefix, queue_name, token, handler, opts, job).await;
                drop(permit);
            });
        }

        tracing::info!(queue = %queue_name, "wachat-queue consumer draining");
        // Graceful drain: wait for every in-flight task (handlers +
        // sweeper) to finish before returning.
        while in_flight.join_next().await.is_some() {}
        tracing::info!(queue = %queue_name, "wachat-queue consumer stopped");

        Ok(())
    }
}

/// Drive one job from acquisition through completion / failure, with a
/// concurrent lock-renewal task running for the duration of `process`.
async fn run_one_job(
    redis: RedisHandle,
    prefix: String,
    queue_name: String,
    token: String,
    handler: Arc<dyn JobHandler>,
    opts: WorkerOptions,
    job: BullJob,
) {
    let lock_key = keys::lock_key(&prefix, &queue_name, &job.id);
    let lock_duration = opts.lock_duration_ms;
    let renew_interval = opts.lock_renew_ms;

    // Lock-renew task. Lives until the JoinHandle is aborted (when the
    // handler returns) or shutdown is signalled.
    let renewer_redis = redis.clone();
    let renewer_lock_key = lock_key.clone();
    let renewer_token = token.clone();
    let renew_handle = tokio::spawn(async move {
        loop {
            sleep(Duration::from_millis(renew_interval)).await;
            // PEXPIRE only if the value still matches our token (don't
            // extend a lock that's been stolen by the stalled-sweep).
            let renewed = renew_lock(
                &renewer_redis.client,
                &renewer_lock_key,
                &renewer_token,
                lock_duration,
            )
            .await;
            match renewed {
                Ok(true) => {}
                Ok(false) => {
                    tracing::warn!(
                        lock = %renewer_lock_key,
                        "lock lost during processing; renewer giving up"
                    );
                    return;
                }
                Err(err) => {
                    tracing::warn!(
                        lock = %renewer_lock_key,
                        error = %err,
                        "lock renewal failed; will retry next tick"
                    );
                }
            }
        }
    });

    // Run the user handler. Catch panics so a buggy handler can't take
    // down the whole worker; convert the panic into a Failed outcome.
    // We spawn the handler on a fresh tokio task so a panic surfaces as
    // a `JoinError`; this requires the future to be `'static`, hence
    // the moves on `handler_clone` and `job_clone`.
    let handler_clone = handler.clone();
    let job_clone = job.clone();
    let outcome =
        match futures_unwind_safe(async move { handler_clone.process(&job_clone).await }).await {
            Ok(Ok(o)) => o,
            Ok(Err(e)) => JobOutcome::Failed {
                error: format!("{e:#}"),
            },
            Err(panic_msg) => JobOutcome::Failed {
                error: format!("handler panicked: {panic_msg}"),
            },
        };

    renew_handle.abort();
    let _ = renew_handle.await;

    let now = chrono::Utc::now().timestamp_millis();

    let res = match outcome {
        JobOutcome::Completed(value) => {
            move_to_completed(
                &redis.client,
                &prefix,
                &queue_name,
                &job.id,
                &token,
                &value,
                now,
                opts.remove_on_complete_count,
                opts.remove_on_complete_age_ms,
            )
            .await
        }
        JobOutcome::Failed { error } => {
            let retry_delay_ms = compute_retry_delay(&job, &opts);
            let priority = job
                .opts
                .get("priority")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            move_to_failed(
                &redis.client,
                &prefix,
                &queue_name,
                &job.id,
                &token,
                &error,
                now,
                retry_delay_ms,
                priority,
                opts.remove_on_fail_count,
                opts.remove_on_fail_age_ms,
            )
            .await
        }
    };

    if let Err(err) = res {
        tracing::error!(
            queue = %queue_name,
            job_id = %job.id,
            error = %err,
            "failed to record job outcome (lock + state may now be inconsistent — stalled-sweep will recover)"
        );
    }
}

/// Bridge a panicking async handler call into a `Result<T, String>` — we
/// just need the panic-payload string. Implemented by spawning the
/// future on a fresh task and converting the resulting `JoinError` into
/// a panic message; this keeps a buggy handler from poisoning the
/// caller's task.
async fn futures_unwind_safe<F, T>(fut: F) -> Result<T, String>
where
    F: std::future::Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let handle = tokio::spawn(fut);
    match handle.await {
        Ok(v) => Ok(v),
        Err(je) => {
            if je.is_panic() {
                let panic_payload = je.into_panic();
                let msg = if let Some(s) = panic_payload.downcast_ref::<&'static str>() {
                    (*s).to_owned()
                } else if let Some(s) = panic_payload.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "<non-string panic payload>".to_owned()
                };
                Err(msg)
            } else {
                Err(format!("task cancelled: {je}"))
            }
        }
    }
}

/// Compute the retry delay (ms) for a soft-failed job, or `-1` if the
/// job has exhausted its attempts.
///
/// Pure function so we can unit-test it without Redis. Reads `attempts`,
/// `backoff` from the job's `opts` blob (which is the same JSON the
/// producer wrote — see `BullProducer::serialize_opts`).
pub(crate) fn compute_retry_delay(job: &BullJob, _opts: &WorkerOptions) -> i64 {
    let attempts_made_after = job.attempts_made + 1;
    let max_attempts = job
        .opts
        .get("attempts")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    if attempts_made_after >= max_attempts {
        return -1;
    }

    // Read backoff. Two shapes are accepted:
    //   "backoff": 5000                    (BullMQ legacy: ms only)
    //   "backoff": { type, delay }         (preferred, what producer writes)
    let backoff = job.opts.get("backoff");
    let bk = match backoff {
        None => return 0,
        Some(Value::Number(n)) => Backoff::Fixed {
            delay_ms: n.as_u64().unwrap_or(0),
        },
        Some(obj) => {
            let ty = obj.get("type").and_then(|v| v.as_str()).unwrap_or("fixed");
            let delay_ms = obj.get("delay").and_then(|v| v.as_u64()).unwrap_or(0);
            match ty {
                "exponential" => Backoff::Exponential { delay_ms },
                _ => Backoff::Fixed { delay_ms },
            }
        }
    };

    match bk {
        Backoff::Fixed { delay_ms } => delay_ms as i64,
        // BullMQ exponential: `delay * 2^attemptsMade`, capped at i64
        // to avoid overflow for pathological configs.
        Backoff::Exponential { delay_ms } => {
            // Saturate at 31 to keep the shift inside u32 / i64 range
            // — anyone hitting attempts > 31 is misconfigured anyway.
            let shift = attempts_made_after.min(31);
            (delay_ms as i64).saturating_mul(1i64 << shift)
        }
    }
}

/// Build the KEYS / ARGV vectors for `move_to_active.lua`. Pure so we
/// can unit-test the wiring without Redis.
pub(crate) fn build_move_to_active_args(
    prefix: &str,
    queue: &str,
    token: &str,
    lock_duration_ms: u64,
    now_ms: i64,
    max_promote: u32,
) -> (Vec<String>, Vec<String>) {
    let lua_keys = vec![
        keys::wait_key(prefix, queue),        // KEYS[1]
        keys::active_key(prefix, queue),      // KEYS[2]
        keys::prioritized_key(prefix, queue), // KEYS[3]
        keys::delayed_key(prefix, queue),     // KEYS[4]
        keys::stalled_key(prefix, queue),     // KEYS[5]
        keys::meta_key(prefix, queue),        // KEYS[6]
        keys::events_key(prefix, queue),      // KEYS[7]
    ];
    let lua_args = vec![
        keys::queue_prefix(prefix, queue), // ARGV[1]
        token.to_owned(),                  // ARGV[2]
        lock_duration_ms.to_string(),      // ARGV[3]
        now_ms.to_string(),                // ARGV[4]
        max_promote.to_string(),           // ARGV[5]
    ];
    (lua_keys, lua_args)
}

/// Run `move_to_active.lua` and parse the response into a `BullJob`.
async fn move_to_active(
    client: &Client,
    prefix: &str,
    queue: &str,
    token: &str,
    lock_duration_ms: u64,
    max_promote: u32,
) -> Result<Option<BullJob>, QueueError> {
    let now = chrono::Utc::now().timestamp_millis();
    let (lua_keys, lua_args) =
        build_move_to_active_args(prefix, queue, token, lock_duration_ms, now, max_promote);

    let script: &Script = move_to_active_script();
    // The script returns either nil or a six-tuple of strings. Use
    // `Vec<String>` and treat empty as nil — fred's reply parsing
    // collapses Redis nil into an empty Vec.
    let raw: Vec<String> = script
        .evalsha_with_reload(client, lua_keys, lua_args)
        .await
        .map_err(QueueError::from)?;

    if raw.is_empty() {
        return Ok(None);
    }
    if raw.len() != 6 {
        return Err(QueueError::ScriptFailed(format!(
            "moveToActive returned {} fields, expected 6",
            raw.len()
        )));
    }

    parse_active_response(raw).map(Some)
}

/// Convert the raw `[id, name, data, opts, attemptsMade, timestamp]`
/// reply into a typed `BullJob`.
///
/// Pure so we can unit-test the parser without Redis.
pub(crate) fn parse_active_response(raw: Vec<String>) -> Result<BullJob, QueueError> {
    let mut iter = raw.into_iter();
    let id = iter.next().unwrap_or_default();
    let name = iter.next().unwrap_or_default();
    let data_raw = iter.next().unwrap_or_default();
    let opts_raw = iter.next().unwrap_or_default();
    let attempts_made = iter.next().unwrap_or_default();
    let timestamp = iter.next().unwrap_or_default();

    let data: Value = if data_raw.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&data_raw)
            .map_err(|e| QueueError::ScriptFailed(format!("data not JSON: {e}")))?
    };
    let opts: Value = if opts_raw.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&opts_raw)
            .map_err(|e| QueueError::ScriptFailed(format!("opts not JSON: {e}")))?
    };
    let attempts_made: u32 = attempts_made.parse().unwrap_or(0);
    let timestamp: i64 = timestamp.parse().unwrap_or(0);

    Ok(BullJob {
        id,
        name,
        data,
        opts,
        attempts_made,
        timestamp,
    })
}

#[allow(clippy::too_many_arguments)]
async fn move_to_completed(
    client: &Client,
    prefix: &str,
    queue: &str,
    job_id: &str,
    token: &str,
    return_value: &Value,
    finished_on_ms: i64,
    remove_on_complete_count: Option<u32>,
    remove_on_complete_age_ms: Option<u64>,
) -> Result<(), QueueError> {
    let lua_keys = vec![
        keys::active_key(prefix, queue),
        keys::completed_key(prefix, queue),
        keys::stalled_key(prefix, queue),
        keys::events_key(prefix, queue),
        keys::job_key(prefix, queue, job_id),
        keys::lock_key(prefix, queue, job_id),
    ];
    let lua_args = vec![
        job_id.to_owned(),
        token.to_owned(),
        serde_json::to_string(return_value).unwrap_or_else(|_| "null".to_owned()),
        finished_on_ms.to_string(),
        remove_on_complete_count
            .map(|n| n.to_string())
            .unwrap_or_default(),
        remove_on_complete_age_ms
            .map(|n| n.to_string())
            .unwrap_or_default(),
    ];

    let script = move_to_completed_script();
    let _rc: i64 = script
        .evalsha_with_reload(client, lua_keys, lua_args)
        .await
        .map_err(QueueError::from)?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn move_to_failed(
    client: &Client,
    prefix: &str,
    queue: &str,
    job_id: &str,
    token: &str,
    failed_reason: &str,
    finished_on_ms: i64,
    retry_delay_ms: i64,
    priority: u64,
    remove_on_fail_count: Option<u32>,
    remove_on_fail_age_ms: Option<u64>,
) -> Result<(), QueueError> {
    let lua_keys = vec![
        keys::active_key(prefix, queue),
        keys::failed_key(prefix, queue),
        keys::wait_key(prefix, queue),
        keys::delayed_key(prefix, queue),
        keys::prioritized_key(prefix, queue),
        keys::stalled_key(prefix, queue),
        keys::events_key(prefix, queue),
        keys::marker_key(prefix, queue),
        keys::job_key(prefix, queue, job_id),
        keys::lock_key(prefix, queue, job_id),
        keys::priority_counter_key(prefix, queue),
    ];
    let lua_args = vec![
        job_id.to_owned(),
        token.to_owned(),
        failed_reason.to_owned(),
        finished_on_ms.to_string(),
        retry_delay_ms.to_string(),
        priority.to_string(),
        remove_on_fail_count
            .map(|n| n.to_string())
            .unwrap_or_default(),
        remove_on_fail_age_ms
            .map(|n| n.to_string())
            .unwrap_or_default(),
    ];

    let script = move_to_failed_script();
    let _rc: i64 = script
        .evalsha_with_reload(client, lua_keys, lua_args)
        .await
        .map_err(QueueError::from)?;
    Ok(())
}

/// PEXPIRE the lock IF the value still matches our token. Returns
/// `Ok(true)` on success, `Ok(false)` if the lock has been taken from
/// us, `Err` on transport failure.
async fn renew_lock(
    client: &Client,
    lock_key: &str,
    token: &str,
    lock_duration_ms: u64,
) -> Result<bool, QueueError> {
    // Two-step: GET to confirm ownership, then PEXPIRE. Not atomic with
    // a Lua compare-and-extend, but the worst case is a one-tick
    // overlap with the stalled-sweep, which already accepts that race.
    let current: Option<String> = client.get(lock_key).await.map_err(QueueError::from)?;
    match current {
        Some(v) if v == token => {
            let _: Option<bool> = client
                .pexpire(lock_key, lock_duration_ms as i64, None)
                .await
                .map_err(QueueError::from)?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

/// Background task that runs `stalled_check.lua` on a fixed interval.
struct StalledSweeper {
    redis: RedisHandle,
    queue_name: String,
    prefix: String,
    opts: WorkerOptions,
    close: CloseHandle,
}

impl StalledSweeper {
    async fn run(self) {
        let interval = Duration::from_millis(self.opts.stalled_interval_ms);
        loop {
            // Sleep first — at startup, no jobs have stalled yet, and
            // sweeping immediately just wastes a round-trip.
            tokio::select! {
                _ = sleep(interval) => {},
                _ = self.close.wait() => return,
            }

            if let Err(err) = self.sweep_once().await {
                tracing::warn!(
                    queue = %self.queue_name,
                    error = %err,
                    "stalled-job sweep failed"
                );
            }
        }
    }

    async fn sweep_once(&self) -> Result<(), QueueError> {
        let now = chrono::Utc::now().timestamp_millis();
        let lua_keys = vec![
            keys::active_key(&self.prefix, &self.queue_name),
            keys::failed_key(&self.prefix, &self.queue_name),
            keys::wait_key(&self.prefix, &self.queue_name),
            keys::prioritized_key(&self.prefix, &self.queue_name),
            keys::stalled_key(&self.prefix, &self.queue_name),
            keys::events_key(&self.prefix, &self.queue_name),
            keys::marker_key(&self.prefix, &self.queue_name),
            keys::priority_counter_key(&self.prefix, &self.queue_name),
        ];
        let lua_args = vec![
            keys::queue_prefix(&self.prefix, &self.queue_name),
            self.opts.max_stalled_count.to_string(),
            now.to_string(),
        ];

        let script = stalled_check_script();
        // The script returns `[ [failed_ids...], [requeued_ids...] ]`.
        // fred decodes nested RESP arrays as `Vec<Vec<String>>`.
        let raw: Vec<Vec<String>> = script
            .evalsha_with_reload(&self.redis.client, lua_keys, lua_args)
            .await
            .map_err(QueueError::from)?;

        if let (Some(failed), Some(requeued)) = (raw.first(), raw.get(1)) {
            if !failed.is_empty() || !requeued.is_empty() {
                tracing::info!(
                    queue = %self.queue_name,
                    failed = failed.len(),
                    requeued = requeued.len(),
                    "stalled sweep recovered jobs"
                );
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn job(opts: Value, attempts_made: u32) -> BullJob {
        BullJob {
            id: "j1".into(),
            name: "n".into(),
            data: Value::Null,
            attempts_made,
            timestamp: 0,
            opts,
        }
    }

    #[test]
    fn retry_delay_terminal_when_attempts_exhausted() {
        let j = job(
            json!({ "attempts": 3, "backoff": { "type": "fixed", "delay": 1000 } }),
            2,
        );
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), -1);
    }

    #[test]
    fn retry_delay_fixed() {
        let j = job(
            json!({ "attempts": 5, "backoff": { "type": "fixed", "delay": 1500 } }),
            1,
        );
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), 1500);
    }

    #[test]
    fn retry_delay_exponential() {
        // attempts_made_after = 2; delay * 2^2 = 4000
        let j = job(
            json!({ "attempts": 5, "backoff": { "type": "exponential", "delay": 1000 } }),
            1,
        );
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), 4_000);
    }

    #[test]
    fn retry_delay_no_backoff_field_means_zero() {
        let j = job(json!({ "attempts": 2 }), 0);
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), 0);
    }

    #[test]
    fn retry_delay_legacy_numeric_backoff() {
        // BullMQ accepts a bare number as ms-fixed. Verify we honour
        // the same shape.
        let j = job(json!({ "attempts": 3, "backoff": 750 }), 0);
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), 750);
    }

    #[test]
    fn retry_delay_default_attempts_is_one() {
        // No `attempts` key → BullMQ's default is 1, so a first failure
        // is terminal.
        let j = job(json!({}), 0);
        assert_eq!(compute_retry_delay(&j, &WorkerOptions::default()), -1);
    }

    #[test]
    fn move_to_active_args_have_seven_keys_and_five_args() {
        let (k, a) =
            build_move_to_active_args("bull", "broadcast-control", "tok", 30_000, 1234, 16);
        assert_eq!(k.len(), 7);
        assert_eq!(a.len(), 5);
        // KEYS[1] must be the wait list — the lua script reads it as such.
        assert_eq!(k[0], "bull:broadcast-control:wait");
        // ARGV[2] is the worker token; spot-check we wired it through.
        assert_eq!(a[1], "tok");
        // ARGV[3] is lock duration as a decimal string.
        assert_eq!(a[2], "30000");
    }

    #[test]
    fn parse_active_response_handles_full_tuple() {
        let raw = vec![
            "42".into(),
            "process-broadcast".into(),
            r#"{"broadcastId":"abc"}"#.into(),
            r#"{"attempts":3}"#.into(),
            "1".into(),
            "1700000000000".into(),
        ];
        let job = parse_active_response(raw).expect("parses");
        assert_eq!(job.id, "42");
        assert_eq!(job.name, "process-broadcast");
        assert_eq!(job.data["broadcastId"], "abc");
        assert_eq!(job.opts["attempts"], 3);
        assert_eq!(job.attempts_made, 1);
        assert_eq!(job.timestamp, 1_700_000_000_000);
    }

    #[test]
    fn parse_active_response_tolerates_empty_data_and_opts() {
        let raw = vec![
            "1".into(),
            "n".into(),
            "".into(),
            "".into(),
            "0".into(),
            "0".into(),
        ];
        let job = parse_active_response(raw).expect("parses");
        assert!(job.data.is_null());
        assert!(job.opts.is_null());
    }

    #[test]
    fn close_handle_starts_unsignalled_then_flips() {
        let h = CloseHandle::new();
        assert!(!h.is_shutdown());
        h.shutdown();
        assert!(h.is_shutdown());
        // Idempotent.
        h.shutdown();
        assert!(h.is_shutdown());
    }
}
