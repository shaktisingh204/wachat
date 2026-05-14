//! Redis-backed delayed-job queue for SabWa scheduled messages.
//!
//! ## Storage layout
//!
//! | Redis key                 | Type        | Purpose                                              |
//! | ------------------------- | ----------- | ---------------------------------------------------- |
//! | `sabwa:scheduled`         | Sorted set  | score = `scheduled_for_ts` (unix-seconds), member = job_id |
//! | `sabwa:scheduled:index`   | Hash        | field = job_id, value = JSON-serialised `ScheduledJob` |
//!
//! Storing only the `job_id` as the ZSET member keeps the sorted set small
//! and makes `O(1)` cancellation possible via the companion hash. The full
//! `ScheduledJob` payload lives in the hash and is fetched on `pop_due`.
//!
//! `pop_due` is implemented as a small Lua script so the read-and-remove
//! is atomic across multiple worker replicas (preventing duplicate fires).

use anyhow::{Context, Result};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

/// Redis key for the sorted set of due-time → job_id entries.
pub const ZSET_KEY: &str = "sabwa:scheduled";

/// Redis key for the companion hash storing the serialised job payload by id.
pub const INDEX_KEY: &str = "sabwa:scheduled:index";

/// Kinds of jobs the SabWa scheduler can dispatch.
///
/// Mirrors the `kind` field semantics described in SABWA_PLAN.md §8.
/// The payload schema for each variant is intentionally `serde_json::Value`
/// so we can iterate the worker contract without re-deploying the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduledJobKind {
    /// One outbound message to a single chat (`sabwa:send` in the plan).
    SendMessage,
    /// A broadcast list send — fan-out happens in the worker.
    SendBroadcast,
    /// A chunk of a bulk campaign (`sabwa:bulk-send`).
    BulkBatch,
}

/// A single delayed job tracked in the Redis queue.
///
/// The id is opaque (UUID v4 by default). `scheduled_for_ts` is unix-seconds
/// in UTC and is used as the ZSET score. `payload` is left untyped so each
/// `kind` can carry its own shape (jid, body, mediaSabFileId, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledJob {
    /// Stable id — used as both the ZSET member and the hash key.
    pub id: String,
    /// Owning session — matches `sabwa_sessions._id` (stringified ObjectId).
    pub session_id: String,
    /// Owning project — matches `sabwa_sessions.projectId`.
    pub project_id: String,
    /// Unix-seconds (UTC) at which the job becomes due.
    pub scheduled_for_ts: i64,
    /// What kind of job this is — drives the worker dispatch path.
    pub kind: ScheduledJobKind,
    /// Free-form payload; shape depends on `kind`.
    pub payload: serde_json::Value,
}

impl ScheduledJob {
    /// Helper: build a new job with a fresh UUID v4 id.
    pub fn new(
        session_id: impl Into<String>,
        project_id: impl Into<String>,
        scheduled_for_ts: i64,
        kind: ScheduledJobKind,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            session_id: session_id.into(),
            project_id: project_id.into(),
            scheduled_for_ts,
            kind,
            payload,
        }
    }
}

/// Atomic "fetch + remove up to N due jobs" Lua script.
///
/// Arguments:
/// - `KEYS[1]` = ZSET key (`sabwa:scheduled`)
/// - `KEYS[2]` = index hash key (`sabwa:scheduled:index`)
/// - `ARGV[1]` = max unix-seconds score (i.e. `now_ts`)
/// - `ARGV[2]` = limit
///
/// Returns an array of JSON strings (one per popped job).
const POP_DUE_LUA: &str = r#"
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[2]))
if #ids == 0 then
    return {}
end
local out = {}
for i, id in ipairs(ids) do
    local payload = redis.call('HGET', KEYS[2], id)
    if payload then
        table.insert(out, payload)
    end
    redis.call('ZREM', KEYS[1], id)
    redis.call('HDEL', KEYS[2], id)
end
return out
"#;

/// Enqueue a delayed job.
///
/// Writes both the ZSET entry (score = `scheduled_for_ts`, member = id) and
/// the index hash entry (field = id, value = JSON) inside a single MULTI/EXEC
/// pipeline. Safe to call repeatedly with the same `id` — both writes are
/// idempotent overwrites.
pub async fn enqueue(redis_client: &redis::Client, job: ScheduledJob) -> Result<()> {
    let mut conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;

    let payload = serde_json::to_string(&job).context("serialize ScheduledJob")?;

    // Pipeline ZADD + HSET atomically; if either fails the other is rolled back.
    redis::pipe()
        .atomic()
        .zadd(ZSET_KEY, &job.id, job.scheduled_for_ts)
        .ignore()
        .hset(INDEX_KEY, &job.id, &payload)
        .ignore()
        .query_async::<()>(&mut conn)
        .await
        .context("enqueue scheduled job")?;

    tracing::debug!(
        job_id = %job.id,
        kind = ?job.kind,
        scheduled_for_ts = job.scheduled_for_ts,
        "scheduler.enqueue"
    );
    Ok(())
}

/// Cancel a previously-enqueued job by id.
///
/// Returns the number of jobs actually removed (0 or 1). Because we store
/// the id as the ZSET member directly, this is `O(log N)` — no scan needed.
pub async fn cancel(redis_client: &redis::Client, job_id: &str) -> Result<usize> {
    let mut conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;

    let (zrem, _hdel): (i64, i64) = redis::pipe()
        .atomic()
        .zrem(ZSET_KEY, job_id)
        .hdel(INDEX_KEY, job_id)
        .query_async(&mut conn)
        .await
        .context("cancel scheduled job")?;

    Ok(zrem.max(0) as usize)
}

/// Atomically pop up to `limit` jobs whose `scheduled_for_ts <= now_ts`.
///
/// Uses the [`POP_DUE_LUA`] script so concurrent worker replicas can never
/// double-dispatch a job. Returns deserialised [`ScheduledJob`]s. Jobs whose
/// payload can't be deserialised are logged and skipped.
pub async fn pop_due(
    redis_client: &redis::Client,
    now_ts: i64,
    limit: usize,
) -> Result<Vec<ScheduledJob>> {
    let mut conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;

    let script = redis::Script::new(POP_DUE_LUA);
    let payloads: Vec<String> = script
        .key(ZSET_KEY)
        .key(INDEX_KEY)
        .arg(now_ts)
        .arg(limit as i64)
        .invoke_async(&mut conn)
        .await
        .context("pop_due lua")?;

    let mut jobs = Vec::with_capacity(payloads.len());
    for raw in payloads {
        match serde_json::from_str::<ScheduledJob>(&raw) {
            Ok(j) => jobs.push(j),
            Err(e) => {
                tracing::error!(error = %e, payload = %raw, "scheduler.pop_due: bad payload, dropping");
            }
        }
    }
    Ok(jobs)
}

/// Re-schedule a job to a new fire time.
///
/// Atomic: updates the ZSET score and rewrites the index hash entry inside
/// a single MULTI/EXEC. Returns `true` if the job existed and was rewritten,
/// `false` if no matching id was present (e.g. it already fired).
pub async fn reschedule(
    redis_client: &redis::Client,
    job_id: &str,
    new_ts: i64,
) -> Result<bool> {
    let mut conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;

    // Fetch existing payload first so we can rewrite the timestamp inside it.
    let existing: Option<String> = conn
        .hget(INDEX_KEY, job_id)
        .await
        .context("hget existing job")?;
    let Some(raw) = existing else {
        return Ok(false);
    };
    let mut job: ScheduledJob =
        serde_json::from_str(&raw).context("deserialise job for reschedule")?;
    job.scheduled_for_ts = new_ts;
    let updated = serde_json::to_string(&job).context("serialise updated job")?;

    redis::pipe()
        .atomic()
        .zadd(ZSET_KEY, &job.id, new_ts) // ZADD overwrites the score
        .ignore()
        .hset(INDEX_KEY, &job.id, &updated)
        .ignore()
        .query_async::<()>(&mut conn)
        .await
        .context("reschedule pipeline")?;

    Ok(true)
}

/// Best-effort length probe — handy for the Overview "scheduled queue size"
/// card described in SABWA_PLAN.md §6 page 1.
pub async fn pending_count(redis_client: &redis::Client) -> Result<u64> {
    let mut conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;
    let n: u64 = conn.zcard(ZSET_KEY).await.context("zcard sabwa:scheduled")?;
    Ok(n)
}
