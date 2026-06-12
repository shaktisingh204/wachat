//! Campaign orchestration (V2.3 — campaigns that actually send).
//!
//! ## Flow
//!
//! Next.js pre-renders every recipient (template vars already resolved)
//! into `sabsms_campaign_recipients` in 1000-doc chunks, then calls
//! `POST /v1/campaigns/{id}/launch`. The launch endpoint flips the
//! campaign doc `draft|scheduled → running`; from there the **campaign
//! ticker** (spawned in `main` like `delayed::run_ticker`) drives the
//! send: every `TICK_SECS` it claims up to `throttlePerSec × TICK_SECS`
//! pending recipients per running campaign, reserves credits for the
//! batch, materialises a `sabsms_messages` doc per recipient, and
//! LPUSHes the ids onto the normal send queue — so every campaign
//! message flows through the full worker pipeline (compliance kernel,
//! per-message credit hold, provider adapter, retries).
//!
//! ## Chunk-claim design + race safety
//!
//! Recipients are claimed **individually** with repeated
//! `find_one_and_update({campaignId, status: "pending"} → "claimed")`
//! calls, capped at the per-tick quota. `find_one_and_update` is atomic
//! per document, so two engine processes ticking the same campaign can
//! never claim the same recipient — each call either flips exactly one
//! pending doc to claimed (and returns it) or returns `None`. The
//! `chunk` field written by Next is retained for observability and for
//! the `{campaignId, chunk, status}` index, but is deliberately NOT the
//! claim unit: per-doc claims are the simplest design that is provably
//! race-free, and the round-trip cost is bounded by the throttle (the
//! quota is small by construction).
//!
//! The unique index on `idempotencyKey` (`{campaignId}:{contactIdOrPhone}`,
//! mirrored onto the message doc) is the second, belt-and-braces
//! double-send guard: even if a recipient were re-claimed after a
//! crash-recovery sweep, inserting its message doc raises E11000 and we
//! simply mark the recipient `enqueued` without queueing a duplicate.
//!
//! ## Crash recovery
//!
//! A process that dies between claim and enqueue leaves recipients
//! stuck in `claimed`. Every tick we sweep `claimed` docs older than
//! [`CLAIM_STALE_SECS`] back to `pending`; the idempotency-key guard
//! makes the re-run safe.
//!
//! ## Batch credits
//!
//! Before enqueueing a claimed batch we call the Next credits callback
//! `op=reserve-batch` as an **affordability gate**. On approval the
//! hold is released immediately (`charge=false`) because the worker
//! takes the real per-message hold at send time — keeping both holds
//! would double-count and reject campaigns the workspace can afford.
//! On rejection the batch is un-claimed (`claimed → pending`), the
//! campaign is paused with `statusReason: "insufficient_credits"`, and
//! a `CampaignPaused` event is emitted.
//!
//! ## Pause semantics
//!
//! The ticker only processes campaigns with `status: "running"`, so a
//! pause takes effect within one tick (≤ 2s) for everything not yet
//! enqueued. Messages already on the Redis send queue are in-flight and
//! still send — that is intentional (they already passed the credit
//! gate and are owned by the worker pipeline).

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use serde_json::{json, Value};

use crate::{
    credits, db,
    errors::{EngineError, EngineResult},
    events::{self, EngineEvent},
    providers, queue,
    state::AppState,
    types::{CampaignBatchReserveRequest, MessageCategory},
};

/// Ticker cadence in seconds — also the multiplier on `throttlePerSec`
/// when computing the per-tick claim quota.
pub const TICK_SECS: u64 = 2;

/// Default `throttlePerSec` when the campaign doc has none.
pub const DEFAULT_THROTTLE_PER_SEC: i64 = 10;

/// Claimed recipients older than this are considered orphaned by a
/// crashed process and swept back to `pending`.
pub const CLAIM_STALE_SECS: i64 = 60;

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────

/// Per-tick enqueue quota: `throttlePerSec × TICK_SECS`, clamped to a
/// sane range so a corrupt doc can neither stall (0) nor stampede
/// (10k+) the ticker.
pub fn batch_quota(throttle_per_sec: i64) -> usize {
    let t = throttle_per_sec.clamp(1, 500);
    (t as usize) * (TICK_SECS as usize)
}

/// Read the campaign throttle from the doc. Next writes
/// `throttlePerSecond` (the canonical `SabsmsCampaignSchema` field);
/// `throttlePerSec` is accepted as an alias for forward compatibility.
pub fn throttle_from_doc(campaign: &Document) -> i64 {
    for key in ["throttlePerSec", "throttlePerSecond"] {
        if let Ok(v) = campaign.get_i32(key) {
            return v as i64;
        }
        if let Ok(v) = campaign.get_i64(key) {
            return v;
        }
        if let Ok(v) = campaign.get_f64(key) {
            return v as i64;
        }
    }
    DEFAULT_THROTTLE_PER_SEC
}

/// Statuses from which a launch is legal.
pub fn can_launch(status: &str) -> bool {
    matches!(status, "draft" | "scheduled")
}

/// Total billable segments for a claimed batch (sum over pre-rendered
/// bodies).
pub fn segments_total_for(bodies: impl Iterator<Item = impl AsRef<str>>) -> u32 {
    bodies
        .map(|b| providers::estimate_segments(b.as_ref()))
        .sum()
}

fn parse_campaign_id(id: &str) -> EngineResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| EngineError::BadRequest("invalid campaign id".into()))
}

fn now_bson() -> mongodb::bson::DateTime {
    mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis())
}

// ─── Stats denormalisation ────────────────────────────────────────────────

/// Move one message between campaign stat buckets:
/// `$inc { stats.<to>: 1 }` and, when `from` is given,
/// `$inc { stats.<from>: -1 }`. Fire-and-forget — stats are a
/// denormalised view; failures are logged and swallowed.
pub async fn bump_stats(
    state: &Arc<AppState>,
    campaign_id: &str,
    from: Option<&str>,
    to: &str,
) {
    let oid = match ObjectId::parse_str(campaign_id) {
        Ok(o) => o,
        Err(_) => return,
    };
    let mut inc = doc! { format!("stats.{to}"): 1 };
    if let Some(f) = from {
        inc.insert(format!("stats.{f}"), -1);
    }
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    if let Err(e) = campaigns
        .update_one(doc! { "_id": oid }, doc! { "$inc": inc, "$set": { "updatedAt": now_bson() } })
        .await
    {
        tracing::warn!(?e, campaign_id, "failed to bump campaign stats");
    }
}

// ─── HTTP handlers (service-token router) ─────────────────────────────────

/// POST `/v1/campaigns/{id}/launch` — flip a `draft|scheduled` campaign
/// to `running`. Returns `{ ok, recipients }`.
pub async fn launch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    let oid = parse_campaign_id(&id)?;
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);

    let campaign = campaigns
        .find_one(doc! { "_id": &oid })
        .await?
        .ok_or(EngineError::NotFound)?;
    let status = campaign.get_str("status").unwrap_or("");
    if !can_launch(status) {
        return Err(EngineError::BadRequest(format!(
            "campaign status is '{status}', expected draft or scheduled"
        )));
    }

    let now = now_bson();
    // Status-guarded update — a concurrent double-launch loses the race
    // and modifies nothing.
    let res = campaigns
        .update_one(
            doc! { "_id": &oid, "status": { "$in": ["draft", "scheduled"] } },
            doc! { "$set": {
                "status": "running",
                "startedAt": now,
                "updatedAt": now,
            }, "$unset": { "statusReason": "" } },
        )
        .await?;
    if res.modified_count == 0 {
        return Err(EngineError::BadRequest("campaign already launched".into()));
    }

    let recipients = state
        .mongo
        .collection::<Document>(db::COL_CAMPAIGN_RECIPIENTS)
        .count_documents(doc! { "campaignId": &id })
        .await?;

    let workspace_id = campaign.get_str("workspaceId").unwrap_or("").to_string();
    let mut redis = state.redis.clone();
    events::emit(
        &mut redis,
        &EngineEvent::CampaignStarted {
            workspace_id,
            campaign_id: id.clone(),
        },
    )
    .await;

    Ok(Json(json!({ "ok": true, "recipients": recipients })))
}

/// POST `/v1/campaigns/{id}/pause` — `running → paused`. In-flight
/// queue items still send (see module docs).
pub async fn pause(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    let oid = parse_campaign_id(&id)?;
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    let prev = campaigns
        .find_one_and_update(
            doc! { "_id": &oid, "status": "running" },
            doc! { "$set": { "status": "paused", "pausedAt": now, "updatedAt": now } },
        )
        .await?
        .ok_or_else(|| EngineError::BadRequest("campaign is not running".into()))?;

    let workspace_id = prev.get_str("workspaceId").unwrap_or("").to_string();
    let mut redis = state.redis.clone();
    events::emit(
        &mut redis,
        &EngineEvent::CampaignPaused {
            workspace_id,
            campaign_id: id,
        },
    )
    .await;
    Ok(Json(json!({ "ok": true })))
}

/// POST `/v1/campaigns/{id}/resume` — `paused → running`.
pub async fn resume(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    let oid = parse_campaign_id(&id)?;
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    let prev = campaigns
        .find_one_and_update(
            doc! { "_id": &oid, "status": "paused" },
            doc! {
                "$set": { "status": "running", "updatedAt": now },
                "$unset": { "statusReason": "" },
            },
        )
        .await?
        .ok_or_else(|| EngineError::BadRequest("campaign is not paused".into()))?;

    let workspace_id = prev.get_str("workspaceId").unwrap_or("").to_string();
    let mut redis = state.redis.clone();
    events::emit(
        &mut redis,
        &EngineEvent::CampaignStarted {
            workspace_id,
            campaign_id: id,
        },
    )
    .await;
    Ok(Json(json!({ "ok": true })))
}

/// POST `/v1/campaigns/{id}/cancel` — any non-terminal status →
/// `cancelled`; remaining `pending|claimed` recipients are marked
/// `cancelled` so the ticker never picks them up.
pub async fn cancel(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    let oid = parse_campaign_id(&id)?;
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    campaigns
        .find_one_and_update(
            doc! {
                "_id": &oid,
                "status": { "$in": ["draft", "scheduled", "running", "paused"] },
            },
            doc! { "$set": { "status": "cancelled", "cancelledAt": now, "updatedAt": now } },
        )
        .await?
        .ok_or_else(|| EngineError::BadRequest("campaign is not cancellable".into()))?;

    let recipients = state
        .mongo
        .collection::<Document>(db::COL_CAMPAIGN_RECIPIENTS);
    let res = recipients
        .update_many(
            doc! { "campaignId": &id, "status": { "$in": ["pending", "claimed"] } },
            doc! { "$set": { "status": "cancelled", "updatedAt": now } },
        )
        .await?;

    Ok(Json(json!({ "ok": true, "cancelledRecipients": res.modified_count })))
}

// ─── Ticker ───────────────────────────────────────────────────────────────

/// Campaign ticker loop — spawned once per process from `main`.
pub async fn run_ticker(state: Arc<AppState>) {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(TICK_SECS)).await;
        if let Err(e) = tick(&state).await {
            tracing::warn!(?e, "campaign tick failed");
        }
    }
}

async fn tick(state: &Arc<AppState>) -> anyhow::Result<()> {
    promote_scheduled(state).await?;
    sweep_stale_claims(state).await?;

    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let mut cursor = campaigns
        .find(doc! { "status": "running" })
        .limit(200)
        .await?;
    while cursor.advance().await? {
        let campaign: Document = cursor.deserialize_current()?;
        if let Err(e) = process_campaign(state, &campaign).await {
            let id = campaign
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default();
            tracing::warn!(?e, campaign_id = %id, "campaign batch failed");
        }
    }
    Ok(())
}

/// Flip due scheduled campaigns (`scheduledAt <= now`) to running, one
/// at a time so each gets its `CampaignStarted` event. The status
/// filter on `find_one_and_update` keeps multi-process promotion safe.
async fn promote_scheduled(state: &Arc<AppState>) -> anyhow::Result<()> {
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    loop {
        let promoted = campaigns
            .find_one_and_update(
                doc! { "status": "scheduled", "scheduledAt": { "$lte": now } },
                doc! { "$set": { "status": "running", "startedAt": now, "updatedAt": now } },
            )
            .await?;
        let Some(campaign) = promoted else { break };
        let workspace_id = campaign.get_str("workspaceId").unwrap_or("").to_string();
        let campaign_id = campaign
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        tracing::info!(%campaign_id, "scheduled campaign promoted to running");
        let mut redis = state.redis.clone();
        events::emit(
            &mut redis,
            &EngineEvent::CampaignStarted {
                workspace_id,
                campaign_id,
            },
        )
        .await;
    }
    Ok(())
}

/// Crash recovery: claimed recipients whose claim is older than
/// [`CLAIM_STALE_SECS`] go back to pending. Safe to re-run thanks to
/// the idempotency-key guard at enqueue time.
async fn sweep_stale_claims(state: &Arc<AppState>) -> anyhow::Result<()> {
    let cutoff = mongodb::bson::DateTime::from_millis(
        (Utc::now().timestamp() - CLAIM_STALE_SECS) * 1000,
    );
    let recipients = state
        .mongo
        .collection::<Document>(db::COL_CAMPAIGN_RECIPIENTS);
    let res = recipients
        .update_many(
            doc! { "status": "claimed", "claimedAt": { "$lt": cutoff } },
            doc! { "$set": { "status": "pending" }, "$unset": { "claimedAt": "" } },
        )
        .await?;
    if res.modified_count > 0 {
        tracing::warn!(count = res.modified_count, "swept stale recipient claims back to pending");
    }
    Ok(())
}

/// One tick of one running campaign: claim up to the quota, gate the
/// batch on credits, enqueue, and detect completion.
async fn process_campaign(state: &Arc<AppState>, campaign: &Document) -> anyhow::Result<()> {
    let campaign_oid = campaign
        .get_object_id("_id")
        .map_err(|e| anyhow::anyhow!("campaign without _id: {e}"))?;
    let campaign_id = campaign_oid.to_hex();
    let workspace_id = campaign.get_str("workspaceId").unwrap_or("").to_string();
    let quota = batch_quota(throttle_from_doc(campaign));

    let recipients = state
        .mongo
        .collection::<Document>(db::COL_CAMPAIGN_RECIPIENTS);

    // 1. Claim individually — atomic per doc (see module docs).
    let now = now_bson();
    let mut claimed: Vec<Document> = Vec::with_capacity(quota);
    for _ in 0..quota {
        let doc = recipients
            .find_one_and_update(
                doc! { "campaignId": &campaign_id, "status": "pending" },
                doc! { "$set": { "status": "claimed", "claimedAt": now } },
            )
            .await?;
        match doc {
            Some(d) => claimed.push(d),
            None => break,
        }
    }

    // 2. Nothing left to claim → completion check.
    if claimed.is_empty() {
        let remaining = recipients
            .count_documents(doc! {
                "campaignId": &campaign_id,
                "status": { "$in": ["pending", "claimed"] },
            })
            .await?;
        if remaining == 0 {
            try_complete(state, &campaign_id, &workspace_id).await?;
        }
        return Ok(());
    }

    // 3. Batch credit gate (released right after — see module docs).
    let segments_total = segments_total_for(
        claimed
            .iter()
            .map(|r| r.get_str("body").unwrap_or("").to_string()),
    );
    let reserve_req = CampaignBatchReserveRequest {
        workspace_id: workspace_id.clone(),
        campaign_id: campaign_id.clone(),
        count: claimed.len() as u32,
        segments_total,
        estimated_cost: 0,
        category: category_of(campaign),
    };
    match credits::reserve_batch(state, &reserve_req).await {
        Ok(r) if r.approved => {
            // Gate passed — release the hold immediately; the worker
            // takes the real per-message hold at send time.
            credits::release_batch(state, &workspace_id, &campaign_id, &r.reservation_token)
                .await;
        }
        Ok(r) => {
            let reason = r.reason.unwrap_or_else(|| "insufficient_credits".into());
            unclaim(&recipients, &claimed).await?;
            pause_for_credits(state, &campaign_oid, &campaign_id, &workspace_id, &reason).await?;
            return Ok(());
        }
        Err(e) => {
            // Transient callback failure — un-claim and retry next tick.
            tracing::warn!(?e, campaign_id = %campaign_id, "batch credit reserve errored; retrying next tick");
            unclaim(&recipients, &claimed).await?;
            return Ok(());
        }
    }

    // 4. Enqueue each claimed recipient through the normal pipeline.
    let mut enqueued = 0u32;
    for recipient in &claimed {
        match enqueue_recipient(state, campaign, &campaign_id, &workspace_id, recipient).await {
            Ok(fresh) => {
                if fresh {
                    enqueued += 1;
                }
            }
            Err(e) => {
                // Leave the recipient claimed — the stale-claim sweep
                // returns it to pending after CLAIM_STALE_SECS.
                tracing::warn!(?e, campaign_id = %campaign_id, "failed to enqueue recipient");
            }
        }
    }
    if enqueued > 0 {
        let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
        let _ = campaigns
            .update_one(
                doc! { "_id": &campaign_oid },
                doc! { "$inc": { "stats.queued": enqueued as i64 }, "$set": { "updatedAt": now_bson() } },
            )
            .await;
    }
    Ok(())
}

fn category_of(campaign: &Document) -> MessageCategory {
    serde_json::from_str(&format!(
        "\"{}\"",
        campaign.get_str("category").unwrap_or("marketing")
    ))
    .unwrap_or(MessageCategory::Marketing)
}

async fn unclaim(
    recipients: &mongodb::Collection<Document>,
    claimed: &[Document],
) -> anyhow::Result<()> {
    let ids: Vec<ObjectId> = claimed
        .iter()
        .filter_map(|d| d.get_object_id("_id").ok())
        .collect();
    if ids.is_empty() {
        return Ok(());
    }
    recipients
        .update_many(
            doc! { "_id": { "$in": ids }, "status": "claimed" },
            doc! { "$set": { "status": "pending" }, "$unset": { "claimedAt": "" } },
        )
        .await?;
    Ok(())
}

async fn pause_for_credits(
    state: &Arc<AppState>,
    campaign_oid: &ObjectId,
    campaign_id: &str,
    workspace_id: &str,
    reason: &str,
) -> anyhow::Result<()> {
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    campaigns
        .update_one(
            doc! { "_id": campaign_oid, "status": "running" },
            doc! { "$set": {
                "status": "paused",
                "statusReason": "insufficient_credits",
                "pausedAt": now,
                "updatedAt": now,
            }},
        )
        .await?;
    tracing::warn!(campaign_id, reason, "campaign paused: batch credit reservation rejected");
    let mut redis = state.redis.clone();
    events::emit(
        &mut redis,
        &EngineEvent::CampaignPaused {
            workspace_id: workspace_id.to_string(),
            campaign_id: campaign_id.to_string(),
        },
    )
    .await;
    Ok(())
}

async fn try_complete(
    state: &Arc<AppState>,
    campaign_id: &str,
    workspace_id: &str,
) -> anyhow::Result<()> {
    let oid = ObjectId::parse_str(campaign_id)?;
    let campaigns = state.mongo.collection::<Document>(db::COL_CAMPAIGNS);
    let now = now_bson();
    let res = campaigns
        .update_one(
            doc! { "_id": &oid, "status": "running" },
            doc! { "$set": { "status": "completed", "completedAt": now, "updatedAt": now } },
        )
        .await?;
    if res.modified_count == 1 {
        tracing::info!(campaign_id, "campaign completed");
        let mut redis = state.redis.clone();
        events::emit(
            &mut redis,
            &EngineEvent::CampaignCompleted {
                workspace_id: workspace_id.to_string(),
                campaign_id: campaign_id.to_string(),
            },
        )
        .await;
    }
    Ok(())
}

/// Materialise the message doc for one claimed recipient and LPUSH it.
/// Returns `Ok(true)` when a fresh message was enqueued, `Ok(false)`
/// when the idempotency key already existed (duplicate-send guard —
/// recipient is still marked `enqueued`).
async fn enqueue_recipient(
    state: &Arc<AppState>,
    campaign: &Document,
    campaign_id: &str,
    workspace_id: &str,
    recipient: &Document,
) -> anyhow::Result<bool> {
    let recipient_oid = recipient
        .get_object_id("_id")
        .map_err(|e| anyhow::anyhow!("recipient without _id: {e}"))?;
    let to = recipient.get_str("to").unwrap_or("").to_string();
    let body = recipient.get_str("body").unwrap_or("").to_string();
    let from = recipient.get_str("from").unwrap_or("").to_string();
    let provider_account_id = recipient.get_str("providerAccountId").ok();
    let contact_id = recipient.get_str("contactId").ok();
    let idempotency_key = recipient.get_str("idempotencyKey").unwrap_or("").to_string();
    let category = recipient
        .get_str("category")
        .ok()
        .map(|c| c.to_string())
        .unwrap_or_else(|| {
            campaign
                .get_str("category")
                .unwrap_or("marketing")
                .to_string()
        });
    let template_id = campaign.get_str("templateId").ok().filter(|s| !s.is_empty());

    let now = now_bson();
    let segments = providers::estimate_segments(&body) as i32;
    let mut message = doc! {
        "workspaceId": workspace_id,
        "direction": "outbound",
        "channel": "sms",
        "from": &from,
        "to": &to,
        "body": &body,
        "category": &category,
        "status": "queued",
        "provider": "twilio",
        "campaignId": campaign_id,
        "segmentsCount": segments,
        "queuedAt": now,
        "createdAt": now,
        "updatedAt": now,
    };
    if !idempotency_key.is_empty() {
        message.insert("idempotencyKey", &idempotency_key);
    }
    if let Some(acc) = provider_account_id {
        message.insert("providerAccountId", acc);
    }
    if let Some(cid) = contact_id {
        message.insert("contactId", cid);
    }
    if let Some(tid) = template_id {
        message.insert("templateId", tid);
    }

    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let recipients = state
        .mongo
        .collection::<Document>(db::COL_CAMPAIGN_RECIPIENTS);

    let inserted_id = match messages.insert_one(message).await {
        Ok(res) => res.inserted_id.as_object_id().map(|o| o.to_hex()),
        Err(e) if db::is_duplicate_key_error(&e) => {
            // Double-send guard: the message for this idempotency key
            // already exists. Mark the recipient enqueued and move on.
            tracing::info!(
                idempotency_key = %idempotency_key,
                "duplicate campaign recipient skipped (idempotency key exists)"
            );
            None
        }
        Err(e) => return Err(e.into()),
    };

    let mut set = doc! { "status": "enqueued", "enqueuedAt": now, "updatedAt": now };
    if let Some(ref mid) = inserted_id {
        set.insert("messageId", mid.clone());
    }
    recipients
        .update_one(doc! { "_id": recipient_oid }, doc! { "$set": set })
        .await?;

    if let Some(mid) = inserted_id {
        let mut redis = state.redis.clone();
        queue::enqueue_send(&mut redis, &mid).await?;
        events::emit(
            &mut redis,
            &EngineEvent::MessageQueued {
                workspace_id: workspace_id.to_string(),
                message_id: mid,
            },
        )
        .await;
        return Ok(true);
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_quota_is_throttle_times_tick() {
        assert_eq!(batch_quota(10), 20);
        assert_eq!(batch_quota(1), 2);
        assert_eq!(batch_quota(50), 100);
    }

    #[test]
    fn batch_quota_clamps_degenerate_throttles() {
        assert_eq!(batch_quota(0), 2);
        assert_eq!(batch_quota(-5), 2);
        assert_eq!(batch_quota(10_000), 1000);
    }

    #[test]
    fn throttle_reads_canonical_field_and_alias() {
        assert_eq!(throttle_from_doc(&doc! { "throttlePerSecond": 25 }), 25);
        assert_eq!(throttle_from_doc(&doc! { "throttlePerSec": 7 }), 7);
        // Alias wins when both are present (engine-facing override).
        assert_eq!(
            throttle_from_doc(&doc! { "throttlePerSec": 3, "throttlePerSecond": 9 }),
            3
        );
    }

    #[test]
    fn throttle_handles_numeric_bson_widths_and_default() {
        assert_eq!(throttle_from_doc(&doc! { "throttlePerSecond": 12i64 }), 12);
        assert_eq!(throttle_from_doc(&doc! { "throttlePerSecond": 4.0f64 }), 4);
        assert_eq!(throttle_from_doc(&doc! {}), DEFAULT_THROTTLE_PER_SEC);
        assert_eq!(
            throttle_from_doc(&doc! { "throttlePerSecond": "fast" }),
            DEFAULT_THROTTLE_PER_SEC
        );
    }

    #[test]
    fn can_launch_only_from_draft_or_scheduled() {
        assert!(can_launch("draft"));
        assert!(can_launch("scheduled"));
        for s in ["running", "paused", "completed", "cancelled", "failed", ""] {
            assert!(!can_launch(s), "{s} must not be launchable");
        }
    }

    #[test]
    fn segments_total_sums_per_body_estimates() {
        // 1 + 1 + 2 segments (the 200-char GSM-7 body splits at 153).
        let long = "a".repeat(200);
        let bodies = vec!["hello", "world", long.as_str()];
        assert_eq!(segments_total_for(bodies.into_iter()), 4);
    }

    #[test]
    fn segments_total_empty_batch_is_zero() {
        assert_eq!(segments_total_for(std::iter::empty::<&str>()), 0);
    }
}
