//! `sabwa_bulk_campaigns` + `sabwa_bulk_recipients` — bulk-sender data model.
//!
//! Maps to SABWA_PLAN.md §6 page 10 ("Bulk Sender") and §9 (anti-ban). A
//! campaign is the parent document the user creates from the UI; recipients
//! live as one document each in a sibling collection so per-row status
//! (queued → sent / failed / cancelled) doesn't bloat the parent doc.
//!
//! The bulk worker (`crate::workers::bulk`) is the primary consumer:
//!
//! - Reads `sabwa_bulk_campaigns` documents whose status ∈ ['queued', 'running'].
//! - Pops recipients from the Redis ZSET `sabwa:bulk:{campaignId}:queue`.
//! - Persists per-recipient status into `sabwa_bulk_recipients`.
//! - Updates `progress.sent_count` / `progress.failed_count` on the parent.
//!
//! Both structs use loose typing for nested fields (`bson::Document`,
//! `serde_json::Value`) — the bulk runner only needs a handful of well-known
//! keys; everything else round-trips opaquely so we can evolve the wire shape
//! without redeploying the engine.

use anyhow::{anyhow, Context, Result};
use bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::db::serde_dates::{chrono_dt, chrono_dt_opt};

pub const CAMPAIGNS_COLLECTION: &str = "sabwa_bulk_campaigns";
pub const RECIPIENTS_COLLECTION: &str = "sabwa_bulk_recipients";

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Lifecycle status of a [`BulkCampaign`]. Mirrors the string values stored
/// in the `status` field of `sabwa_bulk_campaigns`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BulkCampaignStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Aborted,
    Failed,
}

impl BulkCampaignStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BulkCampaignStatus::Queued => "queued",
            BulkCampaignStatus::Running => "running",
            BulkCampaignStatus::Paused => "paused",
            BulkCampaignStatus::Completed => "completed",
            BulkCampaignStatus::Aborted => "aborted",
            BulkCampaignStatus::Failed => "failed",
        }
    }
}

/// Per-recipient lifecycle. `pending → sent` happy path; other variants are
/// terminal failures or operator-initiated cancellations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BulkRecipientStatus {
    Pending,
    Sent,
    Failed,
    Cancelled,
    Skipped,
}

impl BulkRecipientStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BulkRecipientStatus::Pending => "pending",
            BulkRecipientStatus::Sent => "sent",
            BulkRecipientStatus::Failed => "failed",
            BulkRecipientStatus::Cancelled => "cancelled",
            BulkRecipientStatus::Skipped => "skipped",
        }
    }
}

/// Progress summary embedded under `progress` in `sabwa_bulk_campaigns`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCampaignProgress {
    #[serde(default)]
    pub total: u32,
    #[serde(default)]
    pub sent_count: u32,
    #[serde(default)]
    pub failed_count: u32,
    #[serde(default)]
    pub cancelled_count: u32,
}

/// Parent doc — one per campaign the user kicks off from `/sabwa/bulk`.
///
/// `payload` is intentionally a `serde_json::Value` so the worker can
/// substitute placeholders (`{{firstName}}`) before LPUSH-ing. The shape
/// matches whatever the Bulk Sender wizard wrote (currently
/// `{ "type": "text", "body": "..." }` but can grow to media + caption).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCampaign {
    /// String id (route handlers create these as `cmp_<uuid>` today).
    #[serde(rename = "_id")]
    pub id: String,
    pub project_id: String,
    pub session_id: String,
    pub name: String,
    pub status: String,
    /// Free-form payload — the worker substitutes `{{firstName}}` against
    /// `sabwa_contacts.name` / `push_name` before enqueueing.
    pub payload: serde_json::Value,
    #[serde(default)]
    pub progress: BulkCampaignProgress,
    #[serde(default)]
    pub total: u32,
    /// Count of consecutive WA-layer errors observed by the worker. The
    /// bulk runner auto-pauses on 3 consecutive failures (SABWA_PLAN §9).
    #[serde(default)]
    pub consecutive_errors: u32,
    /// Hard daily-limit pause marker — once we hit `BlockedDaily` the
    /// worker records the UTC day so it knows to auto-resume past the
    /// next 00:00 boundary.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paused_until_utc_day: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(with = "chrono_dt")]
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub updated_at: Option<DateTime<Utc>>,
}

/// One row per recipient. The worker writes these in batches as it drains
/// the Redis queue ZSET.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkRecipient {
    #[serde(rename = "_id", default, skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub campaign_id: String,
    pub session_id: String,
    /// Recipient JID, e.g. `91xxxxxxxxxx@s.whatsapp.net`.
    pub jid: String,
    /// Optional substitution context for `{{firstName}}` etc. — pulled
    /// from `sabwa_contacts` at enqueue time when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    pub status: String,
    /// 1-based send order in the campaign queue (matches the ZSET score).
    #[serde(default)]
    pub order: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(with = "chrono_dt")]
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

pub fn campaigns_collection(db: &Database) -> Collection<bson::Document> {
    db.collection::<bson::Document>(CAMPAIGNS_COLLECTION)
}

pub fn recipients_collection(db: &Database) -> Collection<bson::Document> {
    db.collection::<bson::Document>(RECIPIENTS_COLLECTION)
}

// ---------------------------------------------------------------------------
// Helpers — campaign lookup
// ---------------------------------------------------------------------------

/// Find all campaigns whose `status` is in `['queued', 'running']`.
///
/// Returned as raw `bson::Document`s so callers (the bulk worker) can pluck
/// only the fields they need without forcing a typed deserialize round-trip
/// through `BulkCampaign` — the schema is intentionally loose during Phase 1.
pub async fn find_active_campaigns(db: &Database) -> Result<Vec<bson::Document>> {
    let col = campaigns_collection(db);
    let cursor = col
        .find(doc! { "status": { "$in": ["queued", "running"] } })
        .await
        .context("sabwa_bulk_campaigns.find_active")?;
    let docs: Vec<bson::Document> = cursor
        .try_collect()
        .await
        .context("collect active campaigns")?;
    Ok(docs)
}

/// Fetch one campaign by string id.
pub async fn find_campaign(db: &Database, campaign_id: &str) -> Result<Option<bson::Document>> {
    let col = campaigns_collection(db);
    col.find_one(doc! { "_id": campaign_id })
        .await
        .context("sabwa_bulk_campaigns.find_one")
}

/// Update the campaign `status` plus a few common bookkeeping fields. The
/// `extra` argument is merged into the `$set` document so callers can record
/// timestamps or progress counters in the same write.
pub async fn set_campaign_status(
    db: &Database,
    campaign_id: &str,
    status: BulkCampaignStatus,
    extra: Option<bson::Document>,
) -> Result<()> {
    let col = campaigns_collection(db);
    let mut set = doc! {
        "status": status.as_str(),
        "updatedAt": Bson::DateTime(BsonDateTime::now()),
    };
    if matches!(status, BulkCampaignStatus::Running) {
        set.insert("startedAt", Bson::DateTime(BsonDateTime::now()));
    }
    if matches!(
        status,
        BulkCampaignStatus::Completed | BulkCampaignStatus::Aborted | BulkCampaignStatus::Failed
    ) {
        set.insert("finishedAt", Bson::DateTime(BsonDateTime::now()));
    }
    if let Some(e) = extra {
        for (k, v) in e {
            set.insert(k, v);
        }
    }
    col.update_one(doc! { "_id": campaign_id }, doc! { "$set": set })
        .await
        .context("sabwa_bulk_campaigns.set_status")?;
    Ok(())
}

/// Increment the campaign's `progress.sent_count` / `progress.failed_count`.
pub async fn bump_progress(
    db: &Database,
    campaign_id: &str,
    delta_sent: i64,
    delta_failed: i64,
) -> Result<()> {
    if delta_sent == 0 && delta_failed == 0 {
        return Ok(());
    }
    let col = campaigns_collection(db);
    let inc = doc! {
        "progress.sentCount": delta_sent,
        "progress.failedCount": delta_failed,
    };
    col.update_one(
        doc! { "_id": campaign_id },
        doc! {
            "$inc": inc,
            "$set": { "updatedAt": Bson::DateTime(BsonDateTime::now()) },
        },
    )
    .await
    .context("sabwa_bulk_campaigns.bump_progress")?;
    Ok(())
}

/// Increment / reset the `consecutiveErrors` counter on a campaign.
pub async fn set_consecutive_errors(
    db: &Database,
    campaign_id: &str,
    count: u32,
) -> Result<()> {
    let col = campaigns_collection(db);
    col.update_one(
        doc! { "_id": campaign_id },
        doc! {
            "$set": {
                "consecutiveErrors": count as i32,
                "updatedAt": Bson::DateTime(BsonDateTime::now()),
            }
        },
    )
    .await
    .context("sabwa_bulk_campaigns.set_consecutive_errors")?;
    Ok(())
}

/// Set or clear the `pausedUntilUtcDay` marker used by the daily-limit
/// auto-pause flow.
pub async fn set_paused_until_day(
    db: &Database,
    campaign_id: &str,
    yyyymmdd: Option<&str>,
) -> Result<()> {
    let col = campaigns_collection(db);
    let set = match yyyymmdd {
        Some(d) => doc! { "pausedUntilUtcDay": d, "updatedAt": Bson::DateTime(BsonDateTime::now()) },
        None => doc! { "pausedUntilUtcDay": Bson::Null, "updatedAt": Bson::DateTime(BsonDateTime::now()) },
    };
    col.update_one(doc! { "_id": campaign_id }, doc! { "$set": set })
        .await
        .context("sabwa_bulk_campaigns.set_paused_until_day")?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers — recipients
// ---------------------------------------------------------------------------

/// Upsert one recipient row keyed by `(campaignId, jid)`.
pub async fn upsert_recipient(
    db: &Database,
    campaign_id: &str,
    session_id: &str,
    jid: &str,
    order: u32,
    status: BulkRecipientStatus,
    error: Option<&str>,
    first_name: Option<&str>,
) -> Result<()> {
    let col = recipients_collection(db);
    let mut set = doc! {
        "campaignId": campaign_id,
        "sessionId": session_id,
        "jid": jid,
        "order": order as i32,
        "status": status.as_str(),
        "updatedAt": Bson::DateTime(BsonDateTime::now()),
    };
    if let Some(e) = error {
        set.insert("error", e);
    } else {
        set.insert("error", Bson::Null);
    }
    if let Some(f) = first_name {
        set.insert("firstName", f);
    }
    if matches!(status, BulkRecipientStatus::Sent) {
        set.insert("sentAt", Bson::DateTime(BsonDateTime::now()));
    }
    col.update_one(
        doc! { "campaignId": campaign_id, "jid": jid },
        doc! { "$set": set },
    )
    .upsert(true)
    .await
    .context("sabwa_bulk_recipients.upsert")?;
    Ok(())
}

/// Bulk-mark all `pending` recipients of a campaign as `cancelled`. Used
/// when the campaign receives an `abort` control signal.
pub async fn cancel_remaining_recipients(db: &Database, campaign_id: &str) -> Result<u64> {
    let col = recipients_collection(db);
    let res = col
        .update_many(
            doc! { "campaignId": campaign_id, "status": "pending" },
            doc! {
                "$set": {
                    "status": BulkRecipientStatus::Cancelled.as_str(),
                    "updatedAt": Bson::DateTime(BsonDateTime::now()),
                }
            },
        )
        .await
        .context("sabwa_bulk_recipients.cancel_remaining")?;
    Ok(res.modified_count)
}

/// Decode the loose campaign document into a [`BulkCampaign`]. Used by the
/// worker which prefers the typed view for control-flow.
pub fn decode_campaign(d: &bson::Document) -> Result<BulkCampaign> {
    let id = match d.get("_id") {
        Some(Bson::String(s)) => s.clone(),
        Some(Bson::ObjectId(o)) => o.to_hex(),
        _ => return Err(anyhow!("bulk campaign missing _id")),
    };
    let project_id = match d.get("projectId") {
        Some(Bson::String(s)) => s.clone(),
        Some(Bson::ObjectId(o)) => o.to_hex(),
        _ => String::new(),
    };
    let session_id = match d.get("sessionId") {
        Some(Bson::String(s)) => s.clone(),
        Some(Bson::ObjectId(o)) => o.to_hex(),
        _ => String::new(),
    };
    let name = d.get_str("name").unwrap_or("").to_string();
    let status = d.get_str("status").unwrap_or("queued").to_string();
    let payload = d
        .get("payload")
        .cloned()
        .map(|b| b.into_relaxed_extjson())
        .unwrap_or(serde_json::Value::Null);
    let progress = match d.get("progress") {
        Some(Bson::Document(pd)) => BulkCampaignProgress {
            total: pd.get_i32("total").unwrap_or(0).max(0) as u32,
            sent_count: pd.get_i32("sentCount").unwrap_or(0).max(0) as u32,
            failed_count: pd.get_i32("failedCount").unwrap_or(0).max(0) as u32,
            cancelled_count: pd.get_i32("cancelledCount").unwrap_or(0).max(0) as u32,
        },
        _ => BulkCampaignProgress::default(),
    };
    let total = d.get_i32("total").unwrap_or(progress.total as i32).max(0) as u32;
    let consecutive_errors = d.get_i32("consecutiveErrors").unwrap_or(0).max(0) as u32;
    let paused_until_utc_day = d.get_str("pausedUntilUtcDay").ok().map(str::to_string);
    let started_at = match d.get("startedAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    let finished_at = match d.get("finishedAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    let created_at = match d.get("createdAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => Utc::now(),
    };
    let updated_at = match d.get("updatedAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    Ok(BulkCampaign {
        id,
        project_id,
        session_id,
        name,
        status,
        payload,
        progress,
        total,
        consecutive_errors,
        paused_until_utc_day,
        started_at,
        finished_at,
        created_at,
        updated_at,
    })
}
