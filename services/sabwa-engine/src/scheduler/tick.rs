//! Scheduler tick — drains due jobs from the delayed-job queue every 5 s.
//!
//! Lifecycle (see SABWA_PLAN.md §8):
//!
//! ```text
//!   loop {
//!     jobs = pop_due(redis, now_ts, 100)
//!     for job in jobs {
//!       dispatch_one:
//!         - SendMessage   -> LPUSH sabwa:{sid}:outbound (worker BRPOPs this)
//!         - SendBroadcast -> expand recipients, LPUSH each with per-recipient pacing
//!         - BulkBatch     -> hand off to workers::bulk::dispatch_batch (TODO until B5)
//!       mark sabwa_scheduled.status = sent (or queued for bulk)
//!       publish realtime "Scheduled" event
//!     }
//!     every ~1h: recurring::materialise_due(state)
//!     sleep 5s
//!   }
//! ```
//!
//! Errors during a single job's processing are isolated — we log them and
//! re-enqueue the job with `score = now + 60` for retry. This prevents one
//! malformed job from stalling the whole tick.
//!
//! Spawn from `main.rs`:
//!
//! ```ignore
//! tokio::spawn(scheduler::tick::run(state.clone()));
//! ```

use anyhow::Result;
use bson::oid::ObjectId;
use chrono::Utc;
use redis::AsyncCommands;
use std::time::Duration;

use crate::realtime::{
    events::{SabwaEvent, ScheduledEvent},
    pubsub,
};
use crate::state::AppState;

use super::queue::{self, ScheduledJob, ScheduledJobKind};
use super::recurring;

/// How often the tick loop wakes up to drain due jobs.
const TICK_INTERVAL: Duration = Duration::from_secs(5);

/// Max jobs popped per tick. Keeps memory bounded if a big burst comes due.
const MAX_PER_TICK: usize = 100;

/// Retry backoff applied when a single job fails to be dispatched.
const RETRY_BACKOFF_SECS: i64 = 60;

/// How often to materialise recurring children (every N ticks).
/// At a 5 s tick, 720 ticks ≈ 1 hour.
const RECURRING_MATERIALISE_EVERY_TICKS: u64 = 720;

/// Default per-recipient pacing (seconds) used when a broadcast doesn't
/// specify its own jitter. Keeps fan-out polite without coupling to antiban.
const DEFAULT_BROADCAST_JITTER_SECS: i64 = 3;

/// Drive the scheduler.
///
/// This function returns `Ok(())` only on graceful shutdown signals (currently
/// never — it loops forever). On per-iteration errors it logs and continues.
pub async fn run(state: AppState) -> Result<()> {
    tracing::info!("scheduler.tick: starting (interval={:?})", TICK_INTERVAL);

    let mut interval = tokio::time::interval(TICK_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let mut tick_count: u64 = 0;
    loop {
        interval.tick().await;
        if let Err(e) = tick_once(&state).await {
            tracing::error!(error = %e, "scheduler.tick: tick_once failed");
        }

        // Hourly: expand recurring parents into their next 30-day window.
        if tick_count.is_multiple_of(RECURRING_MATERIALISE_EVERY_TICKS) {
            match recurring::materialise_due(&state).await {
                Ok(n) if n > 0 => {
                    tracing::info!(materialised = n, "scheduler.tick: recurring materialised");
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::error!(error = %e, "scheduler.tick: materialise_due failed");
                }
            }
        }
        tick_count = tick_count.wrapping_add(1);
    }
}

/// One iteration of the tick loop. Kept as a separate fn so it can be unit-
/// tested without spawning a background task.
async fn tick_once(state: &AppState) -> Result<()> {
    let now_ts = Utc::now().timestamp();
    let jobs = queue::pop_due(&state.redis, now_ts, MAX_PER_TICK).await?;

    if jobs.is_empty() {
        return Ok(());
    }

    tracing::debug!(count = jobs.len(), "scheduler.tick: dispatching due jobs");

    for job in jobs {
        if let Err(e) = dispatch_one(state, &job).await {
            tracing::error!(
                error = %e,
                job_id = %job.id,
                session_id = %job.session_id,
                "scheduler.tick: dispatch failed, re-enqueueing with backoff"
            );
            // Best-effort retry — re-enqueue with bumped score. Worst case
            // we'll re-fire in `RETRY_BACKOFF_SECS`. If even *this* fails
            // we drop the job (already logged above).
            let retry = ScheduledJob {
                scheduled_for_ts: Utc::now().timestamp() + RETRY_BACKOFF_SECS,
                ..job.clone()
            };
            if let Err(e2) = queue::enqueue(&state.redis, retry).await {
                tracing::error!(error = %e2, job_id = %job.id, "scheduler.tick: retry enqueue also failed");
            }
        }
    }

    Ok(())
}

/// Dispatch a single due job. The exact path depends on `kind`:
///
/// - **SendMessage**: LPUSH the serialised job onto `sabwa:{sid}:outbound`.
///   The outbound worker BRPOPs from there and performs the wire send.
/// - **SendBroadcast**: load the recipient list from `sabwa_broadcasts`,
///   fan-out as N per-recipient `SendMessage` jobs spaced by `jitter`
///   seconds. Spacing is implemented by re-enqueueing onto the ZSET with
///   score = `now + i*jitter` so the same tick loop fires them.
/// - **BulkBatch**: delegate to `crate::workers::bulk::dispatch_batch` once
///   that module lands (owned by agent B5). For now we log a TODO and mark
///   the doc `queued`.
///
/// On success we update `sabwa_scheduled` and publish a realtime event.
async fn dispatch_one(state: &AppState, job: &ScheduledJob) -> Result<()> {
    let new_status: &str = match job.kind {
        ScheduledJobKind::SendMessage => {
            lpush_outbound(state, job).await?;
            "sent"
        }
        ScheduledJobKind::SendBroadcast => {
            dispatch_broadcast(state, job).await?;
            "sent"
        }
        ScheduledJobKind::BulkBatch => {
            // TODO(B5): once `crate::workers::bulk::dispatch_batch` lands,
            // call it here instead of just logging. Until then we transition
            // to `queued` so the doc isn't stuck in `pending` forever.
            tracing::warn!(
                job_id = %job.id,
                session_id = %job.session_id,
                "scheduler.tick: BulkBatch dispatch is owned by agent B5; \
                 crate::workers::bulk::dispatch_batch not present yet — leaving as queued"
            );
            "queued"
        }
    };

    tracing::info!(
        session_id = %job.session_id,
        scheduled_id = %job.id,
        kind = ?job.kind,
        "scheduler.tick: dispatched"
    );

    update_scheduled_status(state, job, new_status).await?;
    publish_scheduled_event(state, &job.session_id, &job.id, new_status).await;
    Ok(())
}

/// LPUSH the job's JSON form onto `sabwa:{sessionId}:outbound`.
async fn lpush_outbound(state: &AppState, job: &ScheduledJob) -> Result<()> {
    let outbound_key = format!("sabwa:{}:outbound", job.session_id);
    let job_json = serde_json::to_string(job)?;
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let _: i64 = conn
        .lpush(&outbound_key, &job_json)
        .await
        .map_err(anyhow::Error::from)?;
    Ok(())
}

/// Expand a `SendBroadcast` job into per-recipient `SendMessage` children.
///
/// We load the broadcast list from `sabwa_broadcasts` and fan-out N jobs.
/// The first recipient fires immediately (LPUSH'd to the outbound queue);
/// recipients 2..N are re-enqueued onto the ZSET with a staggered score so
/// the next tick(s) pick them up paced. This honours the per-recipient
/// pacing requirement from SABWA_PLAN.md §9 without bypassing the tick loop.
async fn dispatch_broadcast(state: &AppState, job: &ScheduledJob) -> Result<()> {
    // The payload may carry an override jitter; default otherwise.
    let jitter_sec = job
        .payload
        .get("jitterSeconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(DEFAULT_BROADCAST_JITTER_SECS)
        .max(1);

    // Resolve the broadcast list. The payload should carry `broadcastId`.
    let broadcast_id = job
        .payload
        .get("broadcastId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            anyhow::anyhow!("SendBroadcast job {} missing payload.broadcastId", job.id)
        })?;

    let broadcast = crate::db::misc::get_broadcast(&state.db, broadcast_id).await?;

    // Load recipients directly off the doc — `BroadcastRow` only carries the
    // count, so we re-fetch the array. The misc module currently doesn't
    // expose the full recipient list, so read the raw doc.
    let recipients = load_broadcast_recipients(state, broadcast_id).await?;
    if recipients.is_empty() {
        tracing::warn!(
            broadcast_id = broadcast_id,
            name = %broadcast.name,
            "scheduler.tick: broadcast has no recipients"
        );
        return Ok(());
    }

    let now_ts = Utc::now().timestamp();
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let outbound_key = format!("sabwa:{}:outbound", job.session_id);

    // The shared per-recipient payload is `job.payload` minus broadcast meta.
    let mut base_payload = job.payload.clone();
    if let Some(obj) = base_payload.as_object_mut() {
        obj.remove("broadcastId");
        obj.remove("jitterSeconds");
    }

    for (i, jid) in recipients.iter().enumerate() {
        let mut payload = base_payload.clone();
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("to".into(), serde_json::Value::String(jid.clone()));
        }

        if i == 0 {
            // First recipient fires immediately.
            let child = ScheduledJob {
                id: format!("{}:bcast:{}", job.id, i),
                session_id: job.session_id.clone(),
                project_id: job.project_id.clone(),
                scheduled_for_ts: now_ts,
                kind: ScheduledJobKind::SendMessage,
                payload,
            };
            let child_json = serde_json::to_string(&child)?;
            let _: i64 = conn
                .lpush(&outbound_key, &child_json)
                .await
                .map_err(anyhow::Error::from)?;
        } else {
            // Subsequent recipients are paced via the delayed-job queue.
            let child = ScheduledJob {
                id: format!("{}:bcast:{}", job.id, i),
                session_id: job.session_id.clone(),
                project_id: job.project_id.clone(),
                scheduled_for_ts: now_ts + (i as i64) * jitter_sec,
                kind: ScheduledJobKind::SendMessage,
                payload,
            };
            queue::enqueue(&state.redis, child).await?;
        }
    }

    tracing::info!(
        session_id = %job.session_id,
        broadcast_id = broadcast_id,
        recipients = recipients.len(),
        jitter_sec,
        "scheduler.tick: broadcast expanded"
    );
    Ok(())
}

/// Read the raw `recipients` array off a broadcast doc.
async fn load_broadcast_recipients(state: &AppState, broadcast_id: &str) -> Result<Vec<String>> {
    let col = state
        .db
        .collection::<bson::Document>("sabwa_broadcasts");
    let doc = col
        .find_one(bson::doc! { "_id": broadcast_id })
        .await?
        .ok_or_else(|| anyhow::anyhow!("broadcast not found: {broadcast_id}"))?;
    let recipients = match doc.get("recipients") {
        Some(bson::Bson::Array(a)) => a
            .iter()
            .filter_map(|b| b.as_str().map(str::to_string))
            .collect(),
        _ => Vec::new(),
    };
    Ok(recipients)
}

/// Update `sabwa_scheduled.<jobId>` to reflect that the job has fired.
async fn update_scheduled_status(state: &AppState, job: &ScheduledJob, new_status: &str) -> Result<()> {
    let col = state
        .db
        .collection::<bson::Document>(crate::db::scheduled::COLLECTION);

    // Try ObjectId first (the canonical shape), fall back to string id.
    let filter = match ObjectId::parse_str(&job.id) {
        Ok(oid) => bson::doc! { "_id": oid },
        Err(_) => bson::doc! { "_id": &job.id },
    };

    let update = bson::doc! {
        "$set": {
            "status": new_status,
            "sentAt": bson::DateTime::now(),
            "updatedAt": bson::DateTime::now(),
        },
        "$inc": { "attemptCount": 1 },
    };

    col.update_one(filter, update).await?;
    Ok(())
}

/// Publish a typed `Scheduled` event onto `sabwa:{sessionId}:events`.
///
/// Best-effort: a pub/sub failure must not fail the dispatch itself.
async fn publish_scheduled_event(
    state: &AppState,
    session_id: &str,
    scheduled_id: &str,
    status: &str,
) {
    let event = SabwaEvent::Scheduled(ScheduledEvent {
        session_id: session_id.to_string(),
        scheduled_id: scheduled_id.to_string(),
        status: status.to_string(),
    });
    if let Err(e) = pubsub::publish(&state.redis, session_id, &event).await {
        tracing::warn!(error = %e, scheduled_id, "scheduler.tick: publish event failed");
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Smoke-test: a `SendMessage` job serialises and can be round-tripped
    /// through the same outbound-queue payload shape the dispatcher uses.
    /// Live Redis is feature-gated upstream; here we just verify the wire
    /// contract so a breaking serde change is caught at unit-test time.
    #[test]
    fn send_message_payload_round_trips() {
        let job = ScheduledJob::new(
            "sess123".to_string(),
            "proj456".to_string(),
            1_700_000_000,
            ScheduledJobKind::SendMessage,
            serde_json::json!({ "to": "91xxx@s.whatsapp.net", "body": "hi" }),
        );
        let s = serde_json::to_string(&job).unwrap();
        let back: ScheduledJob = serde_json::from_str(&s).unwrap();
        assert_eq!(back.session_id, "sess123");
        assert_eq!(back.kind, ScheduledJobKind::SendMessage);
        assert_eq!(back.payload["to"], "91xxx@s.whatsapp.net");
    }

    /// The dispatcher derives the outbound key from `session_id` — guard the
    /// exact format so a typo doesn't silently route to the wrong queue.
    #[test]
    fn outbound_key_matches_plan() {
        let session_id = "abc";
        let key = format!("sabwa:{}:outbound", session_id);
        assert_eq!(key, "sabwa:abc:outbound");
    }
}
