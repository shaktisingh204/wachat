//! Scheduler tick — drains due jobs from the delayed-job queue every 5 s.
//!
//! Lifecycle (see SABWA_PLAN.md §8):
//!
//! ```text
//!   loop {
//!     jobs = pop_due(redis, now_ts, 100)
//!     for job in jobs {
//!       mark sabwa_scheduled.status = sent (or queued for bulk)
//!       LPUSH sabwa:{session_id}:outbound  <- worker BRPOPs this
//!       publish realtime event "Scheduled"
//!     }
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

use crate::state::AppState;

use super::queue::{self, ScheduledJob, ScheduledJobKind};

/// How often the tick loop wakes up to drain due jobs.
const TICK_INTERVAL: Duration = Duration::from_secs(5);

/// Max jobs popped per tick. Keeps memory bounded if a big burst comes due.
const MAX_PER_TICK: usize = 100;

/// Retry backoff applied when a single job fails to be dispatched.
const RETRY_BACKOFF_SECS: i64 = 60;

/// Drive the scheduler.
///
/// This function returns `Ok(())` only on graceful shutdown signals (currently
/// never — it loops forever). On per-iteration errors it logs and continues.
pub async fn run(state: AppState) -> Result<()> {
    tracing::info!("scheduler.tick: starting (interval={:?})", TICK_INTERVAL);

    let mut interval = tokio::time::interval(TICK_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        if let Err(e) = tick_once(&state).await {
            tracing::error!(error = %e, "scheduler.tick: tick_once failed");
        }
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

/// Dispatch a single due job:
/// 1. Update its `sabwa_scheduled` doc.
/// 2. LPUSH onto the per-session outbound queue (the Baileys worker BRPOPs).
/// 3. Publish a realtime `Scheduled` event for SSE / WS subscribers.
async fn dispatch_one(state: &AppState, job: &ScheduledJob) -> Result<()> {
    // (1) Mark the parent doc in Mongo. For SendMessage / SendBroadcast we
    //     transition to `sent` (the worker will downgrade to `failed` if the
    //     wire call errors). For BulkBatch we transition to `queued` since
    //     the bulk runner owns per-recipient status.
    update_scheduled_status(state, job).await?;

    // (2) LPUSH onto the per-session outbound queue.
    let outbound_key = format!("sabwa:{}:outbound", job.session_id);
    let job_json = serde_json::to_string(job)?;
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let _: i64 = conn
        .lpush(&outbound_key, &job_json)
        .await
        .map_err(anyhow::Error::from)?;

    // (3) Publish a realtime event so the UI's scheduler queue page updates.
    //
    // TODO(realtime): once `realtime::events::SabwaEvent::Scheduled` lands,
    // replace this raw JSON with a typed event constructor. We publish a
    // best-effort JSON blob now so the SSE handler can already round-trip it.
    let event = serde_json::json!({
        "type": "scheduled",
        "jobId": job.id,
        "sessionId": job.session_id,
        "projectId": job.project_id,
        "kind": job.kind,
        "scheduledForTs": job.scheduled_for_ts,
        "firedAt": Utc::now().to_rfc3339(),
    });
    if let Err(e) = publish_scheduled_event(state, &job.session_id, &event).await {
        // Don't fail the dispatch just because pub/sub burped.
        tracing::warn!(error = %e, job_id = %job.id, "scheduler.tick: publish event failed");
    }

    Ok(())
}

/// Update `sabwa_scheduled.<jobId>` to reflect that the job has fired.
///
/// Bulk batches go to `queued` (per-recipient progress is tracked elsewhere);
/// everything else goes to `sent`. If `sabwa_scheduled._id` was an ObjectId we
/// parse it as such; otherwise we fall back to a string-id lookup.
async fn update_scheduled_status(state: &AppState, job: &ScheduledJob) -> Result<()> {
    let new_status = match job.kind {
        ScheduledJobKind::BulkBatch => "queued",
        ScheduledJobKind::SendMessage | ScheduledJobKind::SendBroadcast => "sent",
    };

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

/// Publish a `scheduled` event onto `sabwa:{sessionId}:events`.
///
/// We call into [`crate::realtime::pubsub::publish`] with a JSON payload.
/// The realtime layer is responsible for serialising into the on-wire
/// [`crate::realtime::events::SabwaEvent`] shape.
async fn publish_scheduled_event(
    state: &AppState,
    session_id: &str,
    event: &serde_json::Value,
) -> Result<()> {
    // TODO(realtime): swap the raw-Redis publish below for the typed helper
    // once `realtime::pubsub::publish(&AppState, session_id, SabwaEvent)` is
    // stable. Doing it directly here keeps `tick.rs` decoupled from whichever
    // shape `SabwaEvent::Scheduled` ends up taking.
    let channel = format!("sabwa:{}:events", session_id);
    let payload = serde_json::to_string(event)?;
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let _: i64 = conn
        .publish(&channel, &payload)
        .await
        .map_err(anyhow::Error::from)?;
    Ok(())
}
