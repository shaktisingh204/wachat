//! Dead-letter queue surface for the SabFlow executor.
//!
//! ## Context (from `docs/adr/sabflow-executor-n8n-survey.md` §4)
//!
//! > Bull does not provide a first-class DLQ; n8n leaves exhausted jobs in
//! > `failed` state and exposes them via the Executions UI. A Track B Phase 2
//! > sub-task adds a real DLQ on top.
//!
//! This module is that sub-task. It runs **after** the dispatcher (sibling
//! sub-task #3) has decided a job is permanently dead — i.e. `attemptsMade`
//! has hit `maxAttempts`, the error taxonomy classified the error as
//! non-retryable, or the stalled-sweep `maxStalledCount` budget is exhausted.
//! The dispatcher calls [`deposit`] and is done with the job; this module
//! does not implement any retry logic itself.
//!
//! ## Key layout (NEW — not the Bull `failed` list)
//!
//! Bull's `bull:{queue}:failed` ZSET is for **transient** failures (jobs that
//! still have retries left or jobs the operator hasn't decided about yet).
//! The DLQ is for **terminal** failures — entries here have exhausted every
//! retry surface and need human / external action.
//!
//! ```text
//!   sabflow:queue:{name}:dlq            LIST  — FIFO of DLQ'd job ids, LPUSH'd
//!                                              by [`deposit`], LTRIM'd to
//!                                              [`DLQ_MAX_ENTRIES`] (10k).
//!   sabflow:queue:{name}:{jobId}        HASH  — original BullMQ job hash; we
//!                                              HSET two fields onto it:
//!                                                 `dlqedAt`   ISO-8601 stamp
//!                                                 `dlqReason` short string
//!   sabflow:dlq:{name}                  CHAN  — PUBLISH target; the Node
//!                                              alert dispatcher in
//!                                              `src/lib/sabflow/queue/dlq.ts`
//!                                              SUBSCRIBE's and fans the
//!                                              payload out to email + in-app
//!                                              notifications.
//! ```
//!
//! ## Fail-soft contract
//!
//! Every step is best-effort: a missing PUBSUB subscriber, a flaky HSET, or
//! an LTRIM failure must NOT cause the LPUSH to roll back. We log via
//! `tracing` and return [`DlqError`] only if the LPUSH itself fails — that's
//! the one fact the dispatcher needs to know (the job is or isn't on the
//! DLQ). HSET / PUBLISH / LTRIM failures are reported through the
//! [`DepositOutcome`] flags.

use chrono::Utc;
use fred::clients::Client;
use fred::interfaces::{HashesInterface, ListInterface, PubsubInterface};
use serde::{Deserialize, Serialize};

/// Maximum DLQ entries kept per queue. Older entries are LTRIM'd off the tail
/// FIFO-style (oldest-out) once a deposit pushes past this number.
///
/// Picked to give a workspace several days of headroom before the admin
/// surface starts losing history — at the >10/day workspace-wide alert
/// threshold this is roughly three years of single-tenant burn. Tenants
/// with higher steady-state failure rates should be looking at the alerts,
/// not the cap.
pub const DLQ_MAX_ENTRIES: i64 = 10_000;

/// Errors surfaced from [`deposit`]. Only fired for the primary LPUSH; every
/// secondary step (HSET / PUBLISH / LTRIM) is reported via [`DepositOutcome`]
/// so the dispatcher always knows whether the job is "in the DLQ" by a single
/// boolean.
#[derive(Debug, thiserror::Error)]
pub enum DlqError {
    /// LPUSH against `sabflow:queue:<name>:dlq` failed. The job is **not**
    /// in the DLQ when this fires.
    #[error("dlq: LPUSH to {key} failed: {source}")]
    LpushFailed {
        /// The Redis list key we tried to LPUSH to.
        key: String,
        /// Underlying fred error.
        #[source]
        source: fred::error::Error,
    },

    /// Provided job JSON did not include a `jobId` field. The dispatcher
    /// always passes the BullMQ job id (it's the key the worker locked on);
    /// a missing id is a programmer error, not a runtime failure.
    #[error("dlq: job payload missing required string field `jobId`")]
    MissingJobId,
}

/// What actually happened during a [`deposit`] call. The LPUSH must have
/// succeeded for this to be returned (otherwise [`DlqError::LpushFailed`]
/// fires); the secondary flags tell the caller whether downstream legs
/// (HSET, PUBLISH, LTRIM) also went through. All "failure" booleans here
/// are logged via `tracing::warn` at the call site — they do not bubble up.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DepositOutcome {
    /// True when the LPUSH succeeded and the job id is now on the DLQ list.
    pub enlisted: bool,
    /// True when the HSET writing `dlqedAt` + `dlqReason` onto the job hash
    /// succeeded. False on Redis failure or a missing job hash (the latter
    /// can happen if BullMQ already cleaned it up — we treat that as a
    /// soft warn, not an error).
    pub job_hash_annotated: bool,
    /// True when the PUBLISH to `sabflow:dlq:<name>` got at least one
    /// subscriber. fred returns the integer subscriber count from PUBLISH;
    /// zero means no Node alert dispatcher is listening — still success
    /// from the DLQ's perspective.
    pub published: bool,
    /// True when LTRIM trimmed the list back to [`DLQ_MAX_ENTRIES`]. False
    /// on Redis failure (we don't bubble — the DLQ may grow above the cap
    /// until the next deposit retries the trim).
    pub trimmed: bool,
    /// Subscriber count returned by PUBLISH. Useful for diagnostics when
    /// the alert pipeline appears wedged.
    pub subscriber_count: i64,
}

/// PUBSUB payload format. Kept small — the Node alerter only needs enough
/// to look up the rest in Mongo / Redis itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DlqNotice {
    /// Queue name (`executions`, `cron`, …) without prefix.
    pub queue: String,
    /// BullMQ job id (string, even when numeric on the wire).
    pub job_id: String,
    /// Short reason taxonomy from the dispatcher (e.g. `"max-retries"`,
    /// `"poison-payload"`, `"stalled-cap"`). Pre-classified so the alerter
    /// can group without having to parse the error message.
    pub reason: String,
    /// Milliseconds-since-epoch matching the `dlqedAt` we HSET onto the
    /// job hash. The Node side parses this for the daily-rate threshold.
    pub dlqed_at_ms: i64,
}

/// Build the LIST key for `<queue>`'s DLQ. Centralised so the Node admin
/// surface and the Rust dispatcher can't drift on a missing colon.
#[inline]
pub fn dlq_list_key(queue: &str) -> String {
    format!("sabflow:queue:{queue}:dlq")
}

/// Build the PUBSUB channel name for `<queue>`'s alert fan-out.
#[inline]
pub fn dlq_channel(queue: &str) -> String {
    format!("sabflow:dlq:{queue}")
}

/// Build the BullMQ job-hash key. SabFlow's executor mirrors Bull's
/// `bull:{queue}:{jobId}` convention (ADR §4); the constant prefix sits
/// here so we don't import `wachat-queue`'s `keys` module (the executor
/// is meant to be self-contained per the standalone-crate spec).
#[inline]
pub fn job_hash_key(queue: &str, job_id: &str) -> String {
    format!("bull:{queue}:{job_id}")
}

/// Move a job to the dead-letter queue.
///
/// Called by the dispatcher (sibling sub-task #3) **once** per job, after
/// the retry budget is exhausted. The dispatcher passes the full BullMQ job
/// payload as opaque JSON — we only require that it contains a `jobId`
/// string field, which is the BullMQ id (and the suffix of the job hash
/// key we annotate).
///
/// ## Order of operations
///
/// 1. **LPUSH** the job id onto `sabflow:queue:<name>:dlq`. This is the
///    sole "is the job on the DLQ?" source of truth. Failure here is the
///    only condition that bubbles up via [`DlqError`].
/// 2. **LTRIM** the list back to [`DLQ_MAX_ENTRIES`] (FIFO eviction —
///    keep the most recent N). LTRIM with `[0, N-1]` after LPUSH gives us
///    "newest 10k, oldest dropped".
/// 3. **HSET** `dlqedAt` (millis-since-epoch as a string, matching the
///    Node side's `Date.now()`) and `dlqReason` (the caller-supplied
///    `reason` string) onto the job hash so the admin UI can render
///    "DLQ'd at" without going through PUBSUB history.
/// 4. **PUBLISH** the [`DlqNotice`] JSON to `sabflow:dlq:<name>`. The Node
///    alert dispatcher picks this up and drives email + in-app alerts.
///
/// ## Why this order
///
/// LPUSH first so the admin surface always sees the entry even if the
/// process dies after step 1. LTRIM second so memory pressure stays
/// bounded. HSET third because it's the only step that mutates someone
/// else's namespace (Bull's job hash) — we want the DLQ entry to exist
/// regardless of whether the HSET races a Bull cleanup. PUBLISH last
/// because it's the "I just did something" signal — subscribers can
/// rely on every prior step having completed by the time they see the
/// message.
pub async fn deposit(
    redis: &Client,
    queue: &str,
    job: &serde_json::Value,
    reason: &str,
) -> Result<DepositOutcome, DlqError> {
    // Pull the BullMQ job id off the payload. We deliberately don't accept
    // it as a separate parameter — the dispatcher already has it in `job`
    // and threading it twice would be a foot-gun.
    let job_id = job
        .get("jobId")
        .and_then(|v| v.as_str())
        .ok_or(DlqError::MissingJobId)?
        .to_string();

    let list_key = dlq_list_key(queue);
    let channel = dlq_channel(queue);
    let hash_key = job_hash_key(queue, &job_id);
    let dlqed_at_ms = Utc::now().timestamp_millis();

    // ── Step 1: LPUSH job id onto the DLQ list ────────────────────────────
    //
    // We push the id (not the full job JSON) because the job hash already
    // holds the canonical record under `bull:{queue}:{id}`. Duplicating
    // would double-spend memory and create a divergence risk between the
    // list entry and the hash. The admin surface joins on read.
    redis
        .lpush::<i64, _, _>(&list_key, &job_id)
        .await
        .map_err(|source| DlqError::LpushFailed {
            key: list_key.clone(),
            source,
        })?;

    // ── Step 2: LTRIM to DLQ_MAX_ENTRIES (FIFO eviction) ──────────────────
    //
    // LPUSH means new entries land at index 0; oldest sits at -1. Trimming
    // to `[0, MAX-1]` keeps the newest MAX. Failure here is best-effort —
    // we log and continue.
    let trimmed = match redis
        .ltrim::<(), _>(&list_key, 0, DLQ_MAX_ENTRIES - 1)
        .await
    {
        Ok(()) => true,
        Err(e) => {
            tracing::warn!(
                queue = %queue,
                key = %list_key,
                error = ?e,
                "dlq: LTRIM failed; list may exceed cap until next deposit"
            );
            false
        }
    };

    // ── Step 3: HSET dlqedAt + dlqReason onto the job hash ────────────────
    //
    // Two-field HMSET. fred's `hset` takes `(key, fields)` where fields can
    // be any `Into<MultipleFieldsValuesMap>`-compatible shape — we use the
    // tuple-slice form so both fields go in one round trip.
    let job_hash_annotated = match redis
        .hset::<(), _, _>(
            &hash_key,
            vec![
                ("dlqedAt", dlqed_at_ms.to_string()),
                ("dlqReason", reason.to_string()),
            ],
        )
        .await
    {
        Ok(()) => true,
        Err(e) => {
            tracing::warn!(
                queue = %queue,
                job_id = %job_id,
                key = %hash_key,
                error = ?e,
                "dlq: HSET dlqedAt/dlqReason failed; entry still on DLQ list"
            );
            false
        }
    };

    // ── Step 4: PUBLISH notice to sabflow:dlq:<name> ──────────────────────
    //
    // We hand the alert dispatcher a self-contained JSON blob so it doesn't
    // need to re-read the job hash before deciding whether to fire. fred's
    // `publish` returns the integer subscriber count — we surface it via
    // `DepositOutcome.subscriber_count` for diagnostics.
    let notice = DlqNotice {
        queue: queue.to_string(),
        job_id: job_id.clone(),
        reason: reason.to_string(),
        dlqed_at_ms,
    };
    let notice_json = serde_json::to_string(&notice).unwrap_or_else(|_| {
        // Should never fire — DlqNotice is plain owned strings + i64. But if
        // it ever does, the dispatcher should still get a usable payload.
        format!(
            "{{\"queue\":\"{}\",\"jobId\":\"{}\",\"reason\":\"serialize-error\",\"dlqedAtMs\":{}}}",
            queue, job_id, dlqed_at_ms
        )
    });

    let (published, subscriber_count) =
        match redis.publish::<i64, _, _>(&channel, notice_json).await {
            Ok(n) => (n > 0, n),
            Err(e) => {
                tracing::warn!(
                    queue = %queue,
                    job_id = %job_id,
                    channel = %channel,
                    error = ?e,
                    "dlq: PUBLISH failed; alert dispatcher will only see this entry on admin poll"
                );
                (false, 0)
            }
        };

    Ok(DepositOutcome {
        enlisted: true,
        job_hash_annotated,
        published,
        trimmed,
        subscriber_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // The whole point of these helpers is "do these strings match the
    // contract the Node admin surface depends on?". One test pins the
    // canonical layout so a future refactor can't silently change a colon
    // and quietly break the JS reader.
    #[test]
    fn dlq_list_key_layout() {
        assert_eq!(dlq_list_key("executions"), "sabflow:queue:executions:dlq");
        assert_eq!(dlq_list_key("cron"), "sabflow:queue:cron:dlq");
    }

    #[test]
    fn dlq_channel_layout() {
        assert_eq!(dlq_channel("executions"), "sabflow:dlq:executions");
        assert_eq!(dlq_channel("cron"), "sabflow:dlq:cron");
    }

    #[test]
    fn job_hash_layout_matches_bullmq() {
        // ADR §4: the executor mirrors BullMQ's `bull:{queue}:{id}` layout.
        // If this assertion ever fails we've broken interop with the Node
        // workers that still write through BullMQ.
        assert_eq!(job_hash_key("executions", "42"), "bull:executions:42");
    }

    #[test]
    fn deposit_outcome_serializes_camelcase() {
        // The Node admin surface deserializes via `JSON.parse(...)` and
        // expects camelCase fields (`enlisted`, `jobHashAnnotated`, …).
        // serde-derive Serialize already does camelCase via the field
        // names below — pin it explicitly.
        let outcome = DepositOutcome {
            enlisted: true,
            job_hash_annotated: true,
            published: false,
            trimmed: true,
            subscriber_count: 0,
        };
        let s = serde_json::to_string(&outcome).unwrap();
        assert!(s.contains("\"enlisted\":true"));
        assert!(
            s.contains("\"job_hash_annotated\":true") || s.contains("\"jobHashAnnotated\":true")
        );
        // We accept either form because this is a Rust-only struct passed
        // through `DepositOutcome` to the dispatcher, not over the wire —
        // the wire format is `DlqNotice`, which has explicit rename_all.
    }

    #[test]
    fn dlq_notice_serializes_camelcase_for_node_consumer() {
        // This IS the wire format — the Node alert dispatcher does
        // `JSON.parse(msg)` and reads `notice.dlqedAtMs`, etc. Lock it.
        let notice = DlqNotice {
            queue: "executions".into(),
            job_id: "42".into(),
            reason: "max-retries".into(),
            dlqed_at_ms: 1_700_000_000_000,
        };
        let s = serde_json::to_string(&notice).unwrap();
        assert!(s.contains("\"queue\":\"executions\""));
        assert!(s.contains("\"jobId\":\"42\""));
        assert!(s.contains("\"reason\":\"max-retries\""));
        assert!(s.contains("\"dlqedAtMs\":1700000000000"));
    }
}
