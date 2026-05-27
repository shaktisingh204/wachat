//! BullMQ consumer loop for the `"email-send"` queue.
//!
//! Three job kinds are dispatched off the `kind` discriminator inside
//! the BullMQ job payload:
//!
//!   * `"test"`           — `{ campaignId, tenantId, toEmails[] }`
//!   * `"start-campaign"` — `{ campaignId, tenantId }`
//!   * `"deliver"`        — `{ campaignId, tenantId, subscriberIds[] }`
//!
//! The `start-campaign` handler fans out child `deliver` jobs (1k
//! subscribers per chunk) onto the same queue using `BullProducer`.
//!
//! Mongo I/O is read-mostly: the consumer reads campaign + subscriber
//! docs, optional brand kit, and writes one `email_events` row per
//! delivery. The `email_reports_cache` rollup is owned by `email-reports`
//! and not touched here.

use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use email_types::{
    EmailBrandKit,
    collections::{
        BRAND_KITS, CAMPAIGNS, EVENTS, SETTINGS, SUBSCRIBERS, SUPPRESSIONS,
    },
};
use futures::TryStreamExt;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use serde_json::{Value, json};
use tracing::{info, warn};
use wachat_queue::{
    BullJob, BullProducer, JobHandler, JobOptions, JobOutcome, Worker, WorkerOptions,
};

use crate::providers::{self, EmailProvider, OutboundMessage};
use crate::render::render_for_subscriber;
use crate::settings::EmailSettingsDoc;

/// Queue + job-name constants. Producers must keep these in lockstep.
const SEND_QUEUE: &str = "email-send";
#[allow(dead_code)]
const JOB_TEST: &str = "test-send";
#[allow(dead_code)]
const JOB_START: &str = "start-campaign";
const JOB_DELIVER: &str = "deliver";

/// Chunk size for `start-campaign → deliver` fan-out.
const DELIVER_CHUNK: usize = 1_000;

/// State the worker library accepts at boot. Cheap to clone.
#[derive(Clone)]
pub struct EmailSenderState {
    pub mongo: MongoHandle,
    /// Used to fan out `deliver` jobs from `start-campaign`.
    pub bull: BullProducer,
    pub redis: RedisHandle,
    /// Base URL for tracking pixel + click-wrap (e.g. `https://app.sabnode.com`).
    pub base_url: String,
    /// HMAC secret for tracking tokens.
    pub tracking_secret: Vec<u8>,
}

/// Run the worker until shutdown is requested.
///
/// Wires a [`wachat_queue::Worker`] to a [`SendHandler`] and blocks the
/// caller. The binary half (not part of this PR) is expected to wrap
/// this call inside a `tokio::select!` against a `tokio::signal` future
/// so it can call `worker.close_handle().shutdown()` on SIGTERM.
pub async fn run(state: EmailSenderState) -> Result<()> {
    let handler = Arc::new(SendHandler::new(state.clone()));
    let worker = Worker::new(
        state.redis.clone(),
        SEND_QUEUE,
        handler,
        WorkerOptions::default(),
    );
    info!(queue = SEND_QUEUE, "email-sender worker starting");
    worker.run().await.map_err(|e| anyhow!("worker failed: {e}"))?;
    info!(queue = SEND_QUEUE, "email-sender worker stopped");
    Ok(())
}

/// Single handler that dispatches by `kind` discriminator.
pub struct SendHandler {
    state: EmailSenderState,
}

impl SendHandler {
    pub fn new(state: EmailSenderState) -> Self {
        Self { state }
    }
}

#[async_trait]
impl JobHandler for SendHandler {
    async fn process(&self, job: &BullJob) -> Result<JobOutcome> {
        let kind = job
            .data
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let result = match kind {
            "test" => handle_test(&self.state, &job.data).await,
            "start-campaign" => handle_start(&self.state, &job.data).await,
            "deliver" => handle_deliver(&self.state, &job.data).await,
            other => Err(anyhow!("unknown job kind `{other}`")),
        };
        match result {
            Ok(v) => Ok(JobOutcome::Completed(v)),
            Err(e) => Ok(JobOutcome::Failed {
                error: format!("{e:#}"),
            }),
        }
    }
}

// ===========================================================================
// kind = "test"
// ===========================================================================

async fn handle_test(state: &EmailSenderState, data: &Value) -> Result<Value> {
    let campaign_id = data
        .get("campaignId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("test job missing campaignId"))?;
    let tenant_id = data
        .get("tenantId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("test job missing tenantId"))?;
    let to_emails: Vec<String> = data
        .get("toEmails")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default();

    let campaign = load_campaign(state, tenant_id, campaign_id).await?;
    let provider = provider_for_tenant(state, tenant_id).await?;
    let from_email = campaign.get_str("fromEmail").unwrap_or("").to_owned();
    let from_name = campaign.get_str("fromName").unwrap_or("").to_owned();

    let now_unix = Utc::now().timestamp();
    let mut delivered: u64 = 0;

    // Synthetic subscriber doc — test sends are not anchored to a real
    // `email_subscribers` row, so we craft a minimal placeholder that
    // exposes the merge tags everyone uses.
    for to in &to_emails {
        let sub = doc! {
            "email": to.clone(),
            "firstName": "Test",
            "lastName": "Recipient",
        };
        let rendered = render_for_subscriber(
            &campaign,
            &sub,
            None,
            &state.base_url,
            &state.tracking_secret,
            now_unix,
        );
        let msg = OutboundMessage {
            from_email: from_email.clone(),
            from_name: from_name.clone(),
            to_email: to.clone(),
            to_name: None,
            subject: rendered.subject,
            html: rendered.html,
            reply_to: None,
            headers: vec![
                ("X-Campaign-Id".to_owned(), campaign_id.to_owned()),
                ("X-Sabnode-Kind".to_owned(), "test".to_owned()),
            ],
        };
        match provider.send(msg).await {
            Ok(receipt) => {
                record_send_event(state, tenant_id, campaign_id, None, to, &receipt).await;
                delivered += 1;
            }
            Err(e) => warn!(error = ?e, "test send failed for {to}"),
        }
    }
    Ok(json!({ "delivered": delivered, "kind": "test" }))
}

// ===========================================================================
// kind = "start-campaign"
// ===========================================================================

async fn handle_start(state: &EmailSenderState, data: &Value) -> Result<Value> {
    let campaign_id = data
        .get("campaignId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("start-campaign missing campaignId"))?;
    let tenant_id = data
        .get("tenantId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("start-campaign missing tenantId"))?;

    let campaign = load_campaign(state, tenant_id, campaign_id).await?;

    // Recipient resolution — same shape as `recipients_count` in
    // email-campaigns but pages through every match.
    let mut list_oids: Vec<ObjectId> = Vec::new();
    if let Ok(arr) = campaign.get_array("listIds") {
        for v in arr {
            if let Bson::ObjectId(o) = v {
                list_oids.push(*o);
            }
        }
    }
    let mut segment_oids: Vec<ObjectId> = Vec::new();
    if let Ok(arr) = campaign.get_array("segmentIds") {
        for v in arr {
            if let Bson::ObjectId(o) = v {
                segment_oids.push(*o);
            }
        }
    }

    let tenant_oid = parse_oid(tenant_id, "tenantId")?;
    let mut or_clauses: Vec<Document> = Vec::new();
    if !list_oids.is_empty() {
        or_clauses.push(doc! { "listId": { "$in": &list_oids } });
    }
    if !segment_oids.is_empty() {
        or_clauses.push(doc! { "segmentIds": { "$in": &segment_oids } });
    }
    if or_clauses.is_empty() {
        return Err(anyhow!("campaign has no listIds or segmentIds"));
    }

    // Suppression set — pull addresses once and store in memory. For
    // very large tenants this would become a streaming join; today the
    // suppression table is bounded.
    let supps_coll = state.mongo.collection::<Document>(SUPPRESSIONS);
    let supp_cursor = supps_coll
        .find(doc! { "userId": tenant_oid })
        .await
        .context("suppressions.find")?;
    let supp_docs: Vec<Document> = supp_cursor.try_collect().await.context("suppressions.collect")?;
    let suppressed: std::collections::HashSet<String> = supp_docs
        .iter()
        .filter_map(|d| d.get_str("email").ok().map(|s| s.to_ascii_lowercase()))
        .collect();

    let subs_coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    let cursor = subs_coll
        .find(doc! {
            "userId": tenant_oid,
            "status": "subscribed",
            "$or": or_clauses,
        })
        .await
        .context("subscribers.find")?;

    let mut chunk: Vec<String> = Vec::with_capacity(DELIVER_CHUNK);
    let mut fanned = 0u64;
    let mut seen = 0u64;

    futures::pin_mut!(cursor);
    while let Some(d) = cursor.try_next().await.context("subscribers.next")? {
        seen += 1;
        if let Ok(email) = d.get_str("email") {
            if suppressed.contains(&email.to_ascii_lowercase()) {
                continue;
            }
        }
        if let Ok(id) = d.get_object_id("_id") {
            chunk.push(id.to_hex());
            if chunk.len() >= DELIVER_CHUNK {
                enqueue_deliver(state, tenant_id, campaign_id, &chunk, fanned).await?;
                fanned += 1;
                chunk.clear();
            }
        }
    }
    if !chunk.is_empty() {
        enqueue_deliver(state, tenant_id, campaign_id, &chunk, fanned).await?;
        fanned += 1;
    }

    info!(
        campaign_id = %campaign_id,
        seen,
        fanned,
        "start-campaign fan-out complete"
    );
    Ok(json!({ "kind": "start-campaign", "seen": seen, "fanned": fanned }))
}

async fn enqueue_deliver(
    state: &EmailSenderState,
    tenant_id: &str,
    campaign_id: &str,
    subscriber_ids: &[String],
    chunk_idx: u64,
) -> Result<()> {
    let payload = json!({
        "kind": "deliver",
        "campaignId": campaign_id,
        "tenantId": tenant_id,
        "subscriberIds": subscriber_ids,
    });
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!("email_deliver_{campaign_id}_{chunk_idx}")),
        ..Default::default()
    };
    state
        .bull
        .add(SEND_QUEUE, JOB_DELIVER, &payload, opts)
        .await
        .map_err(|e| anyhow!("bull.add(deliver): {e}"))?;
    Ok(())
}

// ===========================================================================
// kind = "deliver"
// ===========================================================================

async fn handle_deliver(state: &EmailSenderState, data: &Value) -> Result<Value> {
    let campaign_id = data
        .get("campaignId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("deliver missing campaignId"))?;
    let tenant_id = data
        .get("tenantId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("deliver missing tenantId"))?;
    let subscriber_ids: Vec<String> = data
        .get("subscriberIds")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default();

    if subscriber_ids.is_empty() {
        return Ok(json!({ "kind": "deliver", "delivered": 0 }));
    }

    // Short-circuit if the campaign is paused / cancelled. This is a
    // best-effort guard — the actual status may change mid-chunk, and we
    // accept up-to-one-chunk-worth of overshoot.
    let campaign = load_campaign(state, tenant_id, campaign_id).await?;
    let status = campaign.get_str("status").unwrap_or("");
    if status == "paused" || status == "cancelled" || status == "failed" {
        info!(campaign_id = %campaign_id, status, "skipping deliver — campaign not active");
        return Ok(json!({ "kind": "deliver", "skipped": status }));
    }

    let provider = provider_for_tenant(state, tenant_id).await?;
    let brand_kit = load_brand_kit(state, tenant_id, &campaign).await;
    let from_email = campaign.get_str("fromEmail").unwrap_or("").to_owned();
    let from_name = campaign.get_str("fromName").unwrap_or("").to_owned();

    // Resolve subscribers in a single Mongo round-trip.
    let oids: Vec<ObjectId> = subscriber_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();
    let tenant_oid = parse_oid(tenant_id, "tenantId")?;
    let cursor = state
        .mongo
        .collection::<Document>(SUBSCRIBERS)
        .find(doc! {
            "_id": { "$in": &oids },
            "userId": tenant_oid,
            "status": "subscribed",
        })
        .await
        .context("subscribers.find_batch")?;
    let subs: Vec<Document> = cursor.try_collect().await.context("subscribers.collect_batch")?;

    let now_unix = Utc::now().timestamp();
    let mut delivered = 0u64;
    let mut failed = 0u64;

    for sub in subs {
        let to_email = sub.get_str("email").unwrap_or("").to_owned();
        if to_email.is_empty() {
            continue;
        }
        let sub_id_hex = sub.get_object_id("_id").map(|o| o.to_hex()).ok();

        let rendered = render_for_subscriber(
            &campaign,
            &sub,
            brand_kit.as_ref(),
            &state.base_url,
            &state.tracking_secret,
            now_unix,
        );
        let to_name = match (sub.get_str("firstName").ok(), sub.get_str("lastName").ok()) {
            (Some(f), Some(l)) if !f.is_empty() || !l.is_empty() => {
                Some(format!("{f} {l}").trim().to_owned())
            }
            _ => None,
        };
        let msg = OutboundMessage {
            from_email: from_email.clone(),
            from_name: from_name.clone(),
            to_email: to_email.clone(),
            to_name,
            subject: rendered.subject,
            html: rendered.html,
            reply_to: None,
            headers: vec![
                ("X-Campaign-Id".to_owned(), campaign_id.to_owned()),
                ("X-Sabnode-Kind".to_owned(), "campaign".to_owned()),
            ],
        };
        match provider.send(msg).await {
            Ok(receipt) => {
                record_send_event(
                    state,
                    tenant_id,
                    campaign_id,
                    sub_id_hex.as_deref(),
                    &to_email,
                    &receipt,
                )
                .await;
                delivered += 1;
            }
            Err(e) => {
                warn!(error = ?e, "deliver failed for {to_email}");
                failed += 1;
            }
        }
    }
    Ok(json!({ "kind": "deliver", "delivered": delivered, "failed": failed }))
}

// ===========================================================================
// Helpers
// ===========================================================================

fn parse_oid(s: &str, field: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|e| anyhow!("invalid {field}: {e}"))
}

async fn load_campaign(
    state: &EmailSenderState,
    tenant_id: &str,
    campaign_id: &str,
) -> Result<Document> {
    let tenant_oid = parse_oid(tenant_id, "tenantId")?;
    let camp_oid = parse_oid(campaign_id, "campaignId")?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);
    coll.find_one(doc! { "_id": camp_oid, "userId": tenant_oid })
        .await
        .context("campaigns.find_one")?
        .ok_or_else(|| anyhow!("campaign {campaign_id} not found for tenant"))
}

async fn load_brand_kit(
    state: &EmailSenderState,
    tenant_id: &str,
    campaign: &Document,
) -> Option<EmailBrandKit> {
    let bk_oid = campaign.get_object_id("brandKitId").ok()?;
    let tenant_oid = ObjectId::parse_str(tenant_id).ok()?;
    let doc_ = state
        .mongo
        .collection::<Document>(BRAND_KITS)
        .find_one(doc! { "_id": bk_oid, "userId": tenant_oid })
        .await
        .ok()
        .flatten()?;
    // Best-effort decode — a malformed brand_kit doc shouldn't take a
    // whole deliver chunk down with it.
    let bson_val = Bson::Document(doc_);
    bson::from_bson::<EmailBrandKit>(bson_val).ok()
}

async fn provider_for_tenant(
    state: &EmailSenderState,
    tenant_id: &str,
) -> Result<Box<dyn EmailProvider>> {
    let tenant_oid = parse_oid(tenant_id, "tenantId")?;
    let doc_ = state
        .mongo
        .collection::<Document>(SETTINGS)
        .find_one(doc! { "userId": tenant_oid })
        .await
        .context("email_settings.find_one")?
        .ok_or_else(|| anyhow!("no email_settings document for tenant {tenant_id}"))?;
    let settings: EmailSettingsDoc =
        bson::from_bson(Bson::Document(doc_)).context("email_settings.decode")?;
    providers::for_settings(&settings)
}

/// Record an `email_events` row of `kind = "send"`. Failures are logged
/// but not bubbled — the upstream send already succeeded, and a missing
/// event row will reconcile when provider webhooks land.
async fn record_send_event(
    state: &EmailSenderState,
    tenant_id: &str,
    campaign_id: &str,
    subscriber_id: Option<&str>,
    email: &str,
    receipt: &providers::ProviderReceipt,
) {
    let tenant_oid = match ObjectId::parse_str(tenant_id) {
        Ok(o) => o,
        Err(_) => return,
    };
    let camp_oid = ObjectId::parse_str(campaign_id).ok();
    let sub_oid = subscriber_id.and_then(|s| ObjectId::parse_str(s).ok());

    let now: bson::DateTime = Utc::now().into();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": tenant_oid,
        "kind": "send",
        "email": email,
        "provider": receipt.provider,
        "occurredAt": now,
        "ingestedAt": now,
    };
    if let Some(c) = camp_oid {
        d.insert("campaignId", c);
    }
    if let Some(s) = sub_oid {
        d.insert("subscriberId", s);
    }
    if let Some(ref mid) = receipt.message_id {
        d.insert("messageId", mid.clone());
    }
    if let Err(e) = state
        .mongo
        .collection::<Document>(EVENTS)
        .insert_one(d)
        .await
    {
        warn!(error = ?e, "failed to record send event");
    }
}
