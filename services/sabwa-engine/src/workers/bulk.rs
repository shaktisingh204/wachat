//! Bulk-campaign drain worker.
//!
//! Implements SABWA_PLAN.md §6 page 10 ("Bulk Sender") and §9 (anti-ban) for
//! campaigns kicked off from the UI. The loop polls every 2 seconds for
//! campaigns whose `status` is `queued` or `running`, then for each one:
//!
//! 1. Honours any pending control signal on `sabwa:bulk:{campaignId}:control`
//!    (`pause` / `resume` / `abort`).
//! 2. Computes the effective per-minute budget by combining the session's
//!    rate-profile with its warmup ramp ([`crate::antiban::warmup::Warmup`]).
//! 3. Pops up to `effective_per_minute` recipients off the campaign's queue
//!    ZSET (`sabwa:bulk:{campaignId}:queue`, score = order).
//! 4. For each recipient: calls [`Limiter::check`], substitutes
//!    `{{firstName}}` against the contact cache, LPUSHes the outbound payload
//!    onto `sabwa:{sessionId}:outbound`, then calls [`Limiter::record_send`].
//! 5. Persists per-recipient status to `sabwa_bulk_recipients` and bumps the
//!    parent campaign's `progress.sent_count` / `progress.failed_count`.
//! 6. Auto-pauses on hard daily-limit or 3 consecutive WA-layer errors.
//!
//! ### Why a ZSET, not a list
//!
//! The campaign queue is intentionally a ZSET so the user-visible "order"
//! (deterministic dispatch sequence) is preserved across pause/resume cycles
//! and across multiple worker replicas — ZPOPMIN is atomic.

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{Datelike, Duration, Utc};
use redis::AsyncCommands;
use serde_json::{json, Value as JsonValue};
use std::time::Duration as StdDuration;

use crate::antiban::{
    profiles::RateProfile as AntibanRateProfile,
    rate_limit::{Limiter, LimiterDecision},
    warmup::Warmup,
};
use crate::db::bulk::{
    self, BulkCampaign, BulkCampaignStatus, BulkRecipientStatus,
};
use crate::realtime::{
    events::{SabwaEvent, StatusEvent},
    pubsub,
};
use crate::state::AppState;

/// How often the worker polls Mongo for active campaigns.
const TICK_INTERVAL: StdDuration = StdDuration::from_secs(2);

/// Failure threshold that triggers an auto-pause. See SABWA_PLAN §9.
const MAX_CONSECUTIVE_ERRORS: u32 = 3;

/// Cap on recipients popped in a single tick. Hard ceiling above the
/// per-minute budget so a single huge campaign can't starve other tenants.
const MAX_RECIPIENTS_PER_TICK: usize = 60;

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

/// Drive the bulk-campaign drain loop. Returns only on unrecoverable error;
/// per-iteration failures are logged at `error` and the loop continues.
pub async fn run(state: AppState) -> Result<()> {
    tracing::info!(
        target: "sabwa::workers::bulk",
        interval = ?TICK_INTERVAL,
        "starting bulk-campaign worker"
    );

    let mut interval = tokio::time::interval(TICK_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        if let Err(e) = tick_once(&state).await {
            tracing::error!(
                target: "sabwa::workers::bulk",
                error = %e,
                "tick_once failed"
            );
        }
    }
}

/// One pass over every active campaign. Split out for unit-test reach.
async fn tick_once(state: &AppState) -> Result<()> {
    let docs = bulk::find_active_campaigns(&state.db)
        .await
        .context("listing active bulk campaigns")?;

    if docs.is_empty() {
        return Ok(());
    }

    for d in docs {
        let campaign = match bulk::decode_campaign(&d) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(target: "sabwa::workers::bulk", error = %e, "skipping undecodable campaign");
                continue;
            }
        };

        if let Err(e) = dispatch_batch(state, &campaign.id).await {
            tracing::error!(
                target: "sabwa::workers::bulk",
                campaign_id = %campaign.id,
                error = %e,
                "dispatch_batch failed"
            );
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Public helper — used by scheduler::tick when a BulkBatch job fires
// ---------------------------------------------------------------------------

/// Process one batch of recipients for a single campaign.
///
/// This is the same code path the worker loop runs internally; it's exposed
/// so the scheduler can call it synchronously the moment a `BulkBatch`
/// `ScheduledJob` becomes due (see `scheduler::tick`).
///
/// Returns `Ok(())` whether the campaign progressed, was paused, or
/// completed — only a Mongo / Redis I/O failure produces an `Err`.
pub async fn dispatch_batch(state: &AppState, campaign_id: &str) -> Result<()> {
    // 1. Load the campaign doc.
    let Some(d) = bulk::find_campaign(&state.db, campaign_id).await? else {
        tracing::debug!(target: "sabwa::workers::bulk", campaign_id, "campaign not found");
        return Ok(());
    };
    let mut campaign = bulk::decode_campaign(&d)?;

    // 2. Drain any control signals. May mutate `campaign.status` in place.
    apply_control_signal(state, &mut campaign).await?;

    if campaign.status == "paused"
        || campaign.status == "aborted"
        || campaign.status == "completed"
        || campaign.status == "failed"
    {
        return Ok(());
    }

    // 3. If a daily-limit auto-pause is still active for today, skip.
    if let Some(day) = campaign.paused_until_utc_day.as_deref() {
        if day == current_utc_day() {
            return Ok(());
        }
        // Day rolled over — clear the marker and resume.
        bulk::set_paused_until_day(&state.db, &campaign.id, None).await?;
        tracing::info!(
            target: "sabwa::workers::bulk",
            campaign_id = %campaign.id,
            "daily pause cleared, resuming"
        );
    }

    // 4. Resolve the session's rate-profile + warmup envelope.
    let session_ctx = load_session_context(state, &campaign.session_id).await?;
    let cfg = session_ctx.profile.config();
    let effective_per_min = session_ctx.warmup.effective_per_min(cfg.per_min) as usize;

    // 5. Transition queued -> running on first batch.
    if campaign.status == "queued" {
        bulk::set_campaign_status(&state.db, &campaign.id, BulkCampaignStatus::Running, None)
            .await?;
        tracing::info!(
            target: "sabwa::workers::bulk",
            campaign_id = %campaign.id,
            session_id = %campaign.session_id,
            effective_per_min,
            "campaign started"
        );
    }

    // 6. Pop up to `effective_per_min` recipients from the queue ZSET.
    let to_send = effective_per_min.min(MAX_RECIPIENTS_PER_TICK).max(1);
    let recipients = pop_recipients(state, &campaign.id, to_send).await?;
    if recipients.is_empty() {
        // Queue exhausted — mark complete if no pending recipients remain.
        finalise_if_drained(state, &campaign).await?;
        return Ok(());
    }

    // 7. Dispatch each recipient, honouring the limiter on every send.
    let mut sent = 0i64;
    let mut failed = 0i64;
    let mut consecutive_errors = campaign.consecutive_errors;
    let mut auto_paused = false;

    for (idx, recipient_jid) in recipients.iter().enumerate() {
        let order = idx as u32 + 1;
        let limiter = Limiter {
            redis: &state.redis,
            session_id: &campaign.session_id,
            profile: session_ctx.profile,
        };

        let decision = match limiter.check().await {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    error = %e,
                    "limiter check failed; treating as throttle"
                );
                // Re-enqueue and bail out of this tick.
                reenqueue_recipient(state, &campaign.id, recipient_jid, order).await?;
                continue;
            }
        };

        match decision {
            LimiterDecision::Allow { jitter_ms } => {
                let first_name = lookup_first_name(state, &campaign.session_id, recipient_jid)
                    .await
                    .unwrap_or(None);

                let payload =
                    build_outbound_payload(&campaign.payload, recipient_jid, first_name.as_deref());

                let outbound_key = format!("sabwa:{}:outbound", campaign.session_id);
                let payload_str = serde_json::to_string(&payload)
                    .context("serialise outbound bulk payload")?;

                match lpush(state, &outbound_key, &payload_str).await {
                    Ok(()) => {
                        // Record AFTER successful enqueue.
                        let _ = limiter.record_send().await;

                        bulk::upsert_recipient(
                            &state.db,
                            &campaign.id,
                            &campaign.session_id,
                            recipient_jid,
                            order,
                            BulkRecipientStatus::Sent,
                            None,
                            first_name.as_deref(),
                        )
                        .await?;

                        // Audit row (B8 contract — see audit::record).
                        write_audit(state, &campaign, recipient_jid).await;

                        sent += 1;
                        consecutive_errors = 0;
                        tracing::debug!(
                            target: "sabwa::workers::bulk",
                            campaign_id = %campaign.id,
                            jid = %recipient_jid,
                            "recipient dispatched"
                        );

                        // Pre-send jitter as recommended by the limiter — applied
                        // BEFORE the next recipient so we never burst back-to-back.
                        if jitter_ms > 0 {
                            tokio::time::sleep(StdDuration::from_millis(jitter_ms as u64)).await;
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            target: "sabwa::workers::bulk",
                            campaign_id = %campaign.id,
                            jid = %recipient_jid,
                            error = %e,
                            "LPUSH outbound failed"
                        );
                        bulk::upsert_recipient(
                            &state.db,
                            &campaign.id,
                            &campaign.session_id,
                            recipient_jid,
                            order,
                            BulkRecipientStatus::Failed,
                            Some(&e.to_string()),
                            first_name.as_deref(),
                        )
                        .await?;
                        failed += 1;
                        consecutive_errors = consecutive_errors.saturating_add(1);

                        if consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                            auto_paused = true;
                            break;
                        }
                    }
                }
            }
            LimiterDecision::Throttle { retry_after_ms } => {
                // Re-enqueue the recipient at the front of the queue and stop
                // this tick — next iteration will pick it up after the window
                // rolls over.
                tracing::debug!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    retry_after_ms,
                    "throttled, stopping batch"
                );
                reenqueue_recipient(state, &campaign.id, recipient_jid, order).await?;
                break;
            }
            LimiterDecision::BlockedDaily => {
                tracing::info!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    "daily limit reached, auto-pausing until next UTC day"
                );
                reenqueue_recipient(state, &campaign.id, recipient_jid, order).await?;
                bulk::set_paused_until_day(&state.db, &campaign.id, Some(&current_utc_day()))
                    .await?;
                bulk::set_campaign_status(
                    &state.db,
                    &campaign.id,
                    BulkCampaignStatus::Paused,
                    None,
                )
                .await?;
                publish_paused_event(state, &campaign.session_id, &campaign.id, "daily_limit")
                    .await;
                // Skip remaining recipients of this batch.
                return Ok(());
            }
        }
    }

    // 8. Persist counters + book-keeping.
    if sent != 0 || failed != 0 {
        bulk::bump_progress(&state.db, &campaign.id, sent, failed).await?;
    }
    if consecutive_errors != campaign.consecutive_errors {
        bulk::set_consecutive_errors(&state.db, &campaign.id, consecutive_errors).await?;
    }

    if auto_paused {
        bulk::set_campaign_status(&state.db, &campaign.id, BulkCampaignStatus::Paused, None)
            .await?;
        publish_paused_event(state, &campaign.session_id, &campaign.id, "wa_errors").await;
        tracing::info!(
            target: "sabwa::workers::bulk",
            campaign_id = %campaign.id,
            consecutive_errors,
            "campaign auto-paused after consecutive WA errors"
        );
        return Ok(());
    }

    finalise_if_drained(state, &campaign).await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Control-signal handling
// ---------------------------------------------------------------------------

/// Drain pending control signals from `sabwa:bulk:{campaignId}:control` and
/// mutate `campaign.status` to match. The Redis key is a list — operators
/// push `pause` / `resume` / `abort` strings; we pop one per tick.
async fn apply_control_signal(state: &AppState, campaign: &mut BulkCampaign) -> Result<()> {
    let control_key = format!("sabwa:bulk:{}:control", campaign.id);
    let mut conn = state.redis.get_multiplexed_async_connection().await?;

    // Non-blocking pop — process every queued signal in order.
    loop {
        let signal: Option<String> = conn.lpop(&control_key, None).await.unwrap_or(None);
        let Some(sig) = signal else { break };
        let sig = sig.trim().to_lowercase();
        match sig.as_str() {
            "pause" => {
                bulk::set_campaign_status(
                    &state.db,
                    &campaign.id,
                    BulkCampaignStatus::Paused,
                    None,
                )
                .await?;
                campaign.status = "paused".to_string();
                publish_paused_event(state, &campaign.session_id, &campaign.id, "operator").await;
                tracing::info!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    "campaign paused via control signal"
                );
            }
            "resume" => {
                bulk::set_paused_until_day(&state.db, &campaign.id, None).await?;
                bulk::set_campaign_status(
                    &state.db,
                    &campaign.id,
                    BulkCampaignStatus::Running,
                    None,
                )
                .await?;
                campaign.status = "running".to_string();
                campaign.paused_until_utc_day = None;
                tracing::info!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    "campaign resumed via control signal"
                );
            }
            "abort" => {
                let n = bulk::cancel_remaining_recipients(&state.db, &campaign.id).await?;
                // Drop the queue ZSET entirely.
                let queue_key = format!("sabwa:bulk:{}:queue", campaign.id);
                let _: i64 = conn.del(&queue_key).await.unwrap_or(0);
                bulk::set_campaign_status(
                    &state.db,
                    &campaign.id,
                    BulkCampaignStatus::Aborted,
                    Some(doc! { "progress.cancelledCount": n as i64 }),
                )
                .await?;
                campaign.status = "aborted".to_string();
                tracing::info!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    cancelled = n,
                    "campaign aborted via control signal"
                );
            }
            other => {
                tracing::warn!(
                    target: "sabwa::workers::bulk",
                    campaign_id = %campaign.id,
                    signal = %other,
                    "unknown control signal, ignoring"
                );
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Session context (rate profile + warmup)
// ---------------------------------------------------------------------------

struct SessionContext {
    profile: AntibanRateProfile,
    warmup: Warmup,
}

/// Load the session's rate-profile and warmup state from `sabwa_sessions`.
///
/// Missing or malformed sessions fall back to `(Safe, no-warmup)` — the
/// safest envelope, so a misconfigured row can't accidentally burst.
async fn load_session_context(state: &AppState, session_id: &str) -> Result<SessionContext> {
    let col = state
        .db
        .collection::<bson::Document>(crate::db::sessions::COLLECTION);
    let filter = match ObjectId::parse_str(session_id) {
        Ok(oid) => doc! { "_id": oid },
        Err(_) => doc! { "_id": session_id },
    };
    let Some(d) = col.find_one(filter).await? else {
        return Ok(SessionContext {
            profile: AntibanRateProfile::Safe,
            warmup: Warmup {
                started_at: Utc::now(),
                enabled: false,
            },
        });
    };

    let profile = match d.get_str("rateLimitProfile").unwrap_or("safe") {
        "normal" => AntibanRateProfile::Normal,
        "aggressive" => AntibanRateProfile::Aggressive,
        _ => AntibanRateProfile::Safe,
    };

    let started_at = match d.get("createdAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => Utc::now() - Duration::days(30),
    };
    let warmup_enabled = match d.get("warmupEnabled") {
        Some(Bson::Boolean(b)) => *b,
        _ => false,
    };

    Ok(SessionContext {
        profile,
        warmup: Warmup {
            started_at,
            enabled: warmup_enabled,
        },
    })
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

/// Pop up to `n` recipients off the campaign queue ZSET in score order.
async fn pop_recipients(state: &AppState, campaign_id: &str, n: usize) -> Result<Vec<String>> {
    let key = format!("sabwa:bulk:{}:queue", campaign_id);
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    // ZPOPMIN returns Vec<(member, score)>. We just want the members.
    let popped: Vec<(String, f64)> = conn
        .zpopmin(&key, n as isize)
        .await
        .with_context(|| format!("ZPOPMIN {}", key))?;
    Ok(popped.into_iter().map(|(m, _)| m).collect())
}

/// Re-add a recipient to the queue with its prior order as the score. Used
/// when we have to back out a pop (throttled / daily-blocked / queue-write
/// failed).
async fn reenqueue_recipient(
    state: &AppState,
    campaign_id: &str,
    jid: &str,
    order: u32,
) -> Result<()> {
    let key = format!("sabwa:bulk:{}:queue", campaign_id);
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let _: i64 = conn.zadd(&key, jid, order as f64).await.unwrap_or(0);
    Ok(())
}

/// Thin LPUSH wrapper used to enqueue the built outbound payload onto the
/// session's worker queue (`sabwa:{sessionId}:outbound`).
async fn lpush(state: &AppState, key: &str, value: &str) -> Result<()> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let _: i64 = conn
        .lpush(key, value)
        .await
        .with_context(|| format!("LPUSH {}", key))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Payload / personalisation
// ---------------------------------------------------------------------------

/// Look up the recipient's first name from `sabwa_contacts`. Returns `Ok(None)`
/// if no row exists — callers fall back to leaving `{{firstName}}` empty.
async fn lookup_first_name(
    state: &AppState,
    session_id: &str,
    jid: &str,
) -> Result<Option<String>> {
    let col = state
        .db
        .collection::<bson::Document>(crate::db::contacts::COLLECTION);
    let filter = match ObjectId::parse_str(session_id) {
        Ok(oid) => doc! { "sessionId": oid, "jid": jid },
        Err(_) => doc! { "sessionId": session_id, "jid": jid },
    };
    let Some(d) = col.find_one(filter).await? else {
        return Ok(None);
    };
    // Prefer `name`, fall back to `pushName`. We split on whitespace to get
    // the first token — same convention the Next.js renderer uses.
    let raw = d
        .get_str("name")
        .ok()
        .or_else(|| d.get_str("pushName").ok());
    Ok(raw
        .and_then(|s| s.split_whitespace().next().map(str::to_string))
        .filter(|s| !s.is_empty()))
}

/// Build the outbound payload by substituting `{{firstName}}` in any string
/// fields of `campaign.payload`. The result is wrapped with `{ jid, message }`
/// so the WA worker (B5) only has to peel one layer.
fn build_outbound_payload(
    campaign_payload: &JsonValue,
    jid: &str,
    first_name: Option<&str>,
) -> JsonValue {
    let mut message = campaign_payload.clone();
    let replacement = first_name.unwrap_or("");
    substitute_placeholders_inplace(&mut message, replacement);
    json!({
        "jid": jid,
        "message": message,
        "source": "bulk",
    })
}

/// Recursively walk a JSON value and replace `{{firstName}}` in every string
/// leaf. Kept simple — we only support one placeholder today; richer Liquid /
/// Handlebars substitution lives behind a future agent.
fn substitute_placeholders_inplace(value: &mut JsonValue, first_name: &str) {
    match value {
        JsonValue::String(s) => {
            if s.contains("{{firstName}}") {
                *s = s.replace("{{firstName}}", first_name);
            }
        }
        JsonValue::Array(arr) => {
            for v in arr {
                substitute_placeholders_inplace(v, first_name);
            }
        }
        JsonValue::Object(map) => {
            for (_, v) in map.iter_mut() {
                substitute_placeholders_inplace(v, first_name);
            }
        }
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Audit + realtime helpers
// ---------------------------------------------------------------------------

/// Best-effort audit row. Failures are swallowed so an audit-log outage never
/// stalls a campaign. (B8 owns `crate::audit::record`; this matches its
/// signature.)
async fn write_audit(state: &AppState, campaign: &BulkCampaign, jid: &str) {
    let mut entry = crate::audit::AuditEntry::new(&campaign.project_id, "bulk.recipient_sent");
    entry.session_id = Some(campaign.session_id.clone());
    entry.target_kind = Some("bulk_campaign".to_string());
    entry.target_id = Some(campaign.id.clone());
    entry.metadata = json!({ "jid": jid });
    // TODO(B8): drop this swallow once audit::record gains a proper retry path.
    let _ = crate::audit::record(state, entry).await;
}

/// Publish a `Status` event with `kind = "campaign_paused"`. The
/// `SabwaEvent::Status` variant carries a free-form `detail` string we use to
/// distinguish the underlying cause.
async fn publish_paused_event(
    state: &AppState,
    session_id: &str,
    campaign_id: &str,
    reason: &str,
) {
    let ev = SabwaEvent::Status(StatusEvent {
        session_id: session_id.to_string(),
        status: "campaign_paused".to_string(),
        detail: Some(format!("{campaign_id}:{reason}")),
        ts: Utc::now().timestamp_millis(),
    });
    if let Err(e) = pubsub::publish(&state.redis, session_id, &ev).await {
        tracing::warn!(
            target: "sabwa::workers::bulk",
            campaign_id,
            error = %e,
            "publish campaign_paused event failed"
        );
    }
}

// ---------------------------------------------------------------------------
// Completion bookkeeping
// ---------------------------------------------------------------------------

/// If the queue ZSET is empty AND no recipient rows remain in `pending`,
/// transition the campaign to `completed` and log it.
async fn finalise_if_drained(state: &AppState, campaign: &BulkCampaign) -> Result<()> {
    let queue_key = format!("sabwa:bulk:{}:queue", campaign.id);
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let remaining: u64 = conn.zcard(&queue_key).await.unwrap_or(0);
    if remaining > 0 {
        return Ok(());
    }

    let rec_col = bulk::recipients_collection(&state.db);
    let pending = rec_col
        .count_documents(doc! { "campaignId": &campaign.id, "status": "pending" })
        .await
        .unwrap_or(0);
    if pending > 0 {
        return Ok(());
    }

    bulk::set_campaign_status(
        &state.db,
        &campaign.id,
        BulkCampaignStatus::Completed,
        None,
    )
    .await?;
    tracing::info!(
        target: "sabwa::workers::bulk",
        campaign_id = %campaign.id,
        "campaign completed"
    );
    Ok(())
}

/// Current UTC day formatted as `YYYYMMDD` — matches the rate-limit key
/// format so we can compare apples to apples.
fn current_utc_day() -> String {
    let now = Utc::now();
    format!("{:04}{:02}{:02}", now.year(), now.month(), now.day())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_substitution_handles_strings() {
        let mut v = json!({ "type": "text", "body": "Hi {{firstName}}!" });
        substitute_placeholders_inplace(&mut v, "Asha");
        assert_eq!(v["body"], "Hi Asha!");
    }

    #[test]
    fn placeholder_substitution_walks_nested() {
        let mut v = json!({
            "type": "media",
            "caption": "yo {{firstName}}",
            "extra": [{ "label": "{{firstName}}-vip" }],
        });
        substitute_placeholders_inplace(&mut v, "Bob");
        assert_eq!(v["caption"], "yo Bob");
        assert_eq!(v["extra"][0]["label"], "Bob-vip");
    }

    #[test]
    fn placeholder_empty_replacement_leaves_braces_gone() {
        let mut v = json!({ "body": "Hello {{firstName}}!" });
        substitute_placeholders_inplace(&mut v, "");
        assert_eq!(v["body"], "Hello !");
    }

    #[test]
    fn build_outbound_payload_wraps_with_jid() {
        let p = json!({ "type": "text", "body": "hi {{firstName}}" });
        let out = build_outbound_payload(&p, "91x@s.whatsapp.net", Some("Sam"));
        assert_eq!(out["jid"], "91x@s.whatsapp.net");
        assert_eq!(out["message"]["body"], "hi Sam");
        assert_eq!(out["source"], "bulk");
    }

    #[test]
    fn current_utc_day_is_8_digits() {
        let s = current_utc_day();
        assert_eq!(s.len(), 8);
        assert!(s.chars().all(|c| c.is_ascii_digit()));
    }
}
