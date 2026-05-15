//! `sabwa_scheduled` — scheduled / recurring outbound messages.
//!
//! See SABWA_PLAN.md §3 "sabwa_scheduled".

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::db::serde_dates::{chrono_dt, chrono_dt_opt};

pub const COLLECTION: &str = "sabwa_scheduled";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduledKind {
    OneOff,
    Recurring,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduledStatus {
    Pending,
    Sent,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduledTargetType {
    Individual,
    Group,
    Broadcast,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTarget {
    pub jid: String,
    #[serde(rename = "type")]
    pub target_type: ScheduledTargetType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledPayload {
    #[serde(rename = "type")]
    pub payload_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_sab_file_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(default)]
    pub mention_all: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaScheduled {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub kind: ScheduledKind,
    #[serde(with = "chrono_dt")]
    pub scheduled_for: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    pub timezone: String,
    pub targets: Vec<ScheduledTarget>,
    pub payload: ScheduledPayload,
    pub status: ScheduledStatus,
    #[serde(default)]
    pub attempt_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bull_job_id: Option<String>,
}

pub struct ScheduledRepo<'a> {
    col: Collection<SabwaScheduled>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> ScheduledRepo<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaScheduled>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn insert(&self, item: &SabwaScheduled) -> Result<ObjectId> {
        let res = self
            .col
            .insert_one(item)
            .await
            .context("sabwa_scheduled.insert")?;
        res.inserted_id
            .as_object_id()
            .context("inserted_id was not ObjectId")
    }

    /// Find all pending scheduled items whose fire time is in the past.
    /// Sorted oldest-first so the worker drains them in order. `limit` caps
    /// the batch size per tick.
    pub async fn find_due(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<SabwaScheduled>> {
        let cursor = self
            .col
            .find(doc! {
                "status": "pending",
                "scheduledFor": { "$lte": Bson::DateTime(now.into()) },
            })
            .sort(doc! { "scheduledFor": 1 })
            .limit(limit.max(1))
            .await
            .context("sabwa_scheduled.find_due")?;
        let out: Vec<SabwaScheduled> = cursor.try_collect().await.context("collect due")?;
        Ok(out)
    }

    pub async fn update_status(
        &self,
        id: &ObjectId,
        status: ScheduledStatus,
        last_error: Option<&str>,
    ) -> Result<()> {
        let status_bson = bson::to_bson(&status).context("encode ScheduledStatus")?;
        let mut set = doc! { "status": status_bson };
        if matches!(status, ScheduledStatus::Sent) {
            set.insert("sentAt", Bson::DateTime(bson::DateTime::now()));
        }
        if let Some(err) = last_error {
            set.insert("lastError", err);
        }
        self.col
            .update_one(doc! { "_id": id }, doc! { "$set": set, "$inc": { "attemptCount": 1 } })
            .await
            .context("sabwa_scheduled.update_status")?;
        Ok(())
    }

    pub async fn cancel(&self, id: &ObjectId) -> Result<()> {
        self.col
            .update_one(
                doc! { "_id": id, "status": "pending" },
                doc! { "$set": { "status": "cancelled" } },
            )
            .await
            .context("sabwa_scheduled.cancel")?;
        Ok(())
    }

    pub async fn find_by_session(
        &self,
        session_id: &ObjectId,
    ) -> Result<Vec<SabwaScheduled>> {
        let cursor = self
            .col
            .find(doc! { "sessionId": session_id })
            .sort(doc! { "scheduledFor": 1 })
            .await
            .context("sabwa_scheduled.find_by_session")?;
        let out: Vec<SabwaScheduled> = cursor.try_collect().await.context("collect scheduled")?;
        Ok(out)
    }
}

pub fn collection(db: &Database) -> Collection<SabwaScheduled> {
    db.collection::<SabwaScheduled>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
//
// Route handlers store string-form ids (e.g. `sch_<uuid>`) on the side and
// use simple flat row projections. We persist these via a fallback `Document`
// collection so the Repo<SabwaScheduled> typed path can stay strict.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTargetRow {
    pub jid: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledRow {
    pub id: String,
    pub session_id: String,
    pub kind: String,
    #[serde(with = "chrono_dt")]
    pub scheduled_for: DateTime<Utc>,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub status: String,
    pub attempt_count: u32,
    pub last_error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub sent_at: Option<DateTime<Utc>>,
    pub targets: Vec<ScheduledTargetRow>,
    pub payload: serde_json::Value,
}

fn scheduled_doc_collection(db: &Database) -> Collection<bson::Document> {
    db.collection::<bson::Document>(COLLECTION)
}

pub async fn insert(
    db: &Database,
    scheduled_id: &str,
    project_id: &str,
    session_id: &str,
    kind: &str,
    scheduled_for: DateTime<Utc>,
    cron: Option<&str>,
    timezone: Option<&str>,
    targets: &[serde_json::Value],
    payload: &serde_json::Value,
) -> Result<()> {
    let col = scheduled_doc_collection(db);
    let targets_bson: Vec<Bson> = targets
        .iter()
        .map(|t| bson::to_bson(t).unwrap_or(Bson::Null))
        .collect();
    let payload_bson = bson::to_bson(payload).unwrap_or(Bson::Null);
    let doc = doc! {
        "_id": scheduled_id,
        "projectId": project_id,
        "sessionId": session_id,
        "kind": kind,
        "scheduledFor": Bson::DateTime(scheduled_for.into()),
        "cron": cron,
        "timezone": timezone,
        "targets": targets_bson,
        "payload": payload_bson,
        "status": "pending",
        "attemptCount": 0i32,
    };
    col.insert_one(doc).await.context("sabwa_scheduled.insert (raw)")?;
    Ok(())
}

pub async fn set_bull_job_id(db: &Database, scheduled_id: &str, job_id: &str) -> Result<()> {
    let col = scheduled_doc_collection(db);
    col.update_one(
        doc! { "_id": scheduled_id },
        doc! { "$set": { "bullJobId": job_id } },
    )
    .await
    .context("sabwa_scheduled.set_bull_job_id")?;
    Ok(())
}

pub async fn list(
    db: &Database,
    session_id: &str,
    status: Option<&str>,
) -> Result<Vec<ScheduledRow>> {
    let col = scheduled_doc_collection(db);
    let mut filter = doc! { "sessionId": session_id };
    if let Some(s) = status {
        filter.insert("status", s);
    }
    let cursor = col
        .find(filter)
        .sort(doc! { "scheduledFor": 1 })
        .await
        .context("sabwa_scheduled.list")?;
    let docs: Vec<bson::Document> =
        cursor.try_collect().await.context("collect scheduled docs")?;
    Ok(docs.into_iter().filter_map(doc_to_row).collect())
}

fn doc_to_row(d: bson::Document) -> Option<ScheduledRow> {
    let id = match d.get("_id") {
        Some(Bson::String(s)) => s.clone(),
        Some(Bson::ObjectId(o)) => o.to_hex(),
        _ => return None,
    };
    let session_id = match d.get("sessionId") {
        Some(Bson::String(s)) => s.clone(),
        Some(Bson::ObjectId(o)) => o.to_hex(),
        _ => String::new(),
    };
    let kind = d.get_str("kind").unwrap_or("one_off").to_string();
    let scheduled_for = match d.get("scheduledFor") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => Utc::now(),
    };
    let cron = d.get_str("cron").ok().map(str::to_string);
    let timezone = d.get_str("timezone").ok().map(str::to_string);
    let status = d.get_str("status").unwrap_or("pending").to_string();
    let attempt_count = d.get_i32("attemptCount").unwrap_or(0).max(0) as u32;
    let last_error = d.get_str("lastError").ok().map(str::to_string);
    let sent_at = match d.get("sentAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    let targets: Vec<ScheduledTargetRow> = match d.get("targets") {
        Some(Bson::Array(arr)) => arr
            .iter()
            .filter_map(|b| {
                let doc = b.as_document()?;
                Some(ScheduledTargetRow {
                    jid: doc.get_str("jid").unwrap_or("").to_string(),
                    kind: doc.get_str("type").unwrap_or("individual").to_string(),
                })
            })
            .collect(),
        _ => Vec::new(),
    };
    let payload = d
        .get("payload")
        .cloned()
        .map(|b| b.into_relaxed_extjson())
        .unwrap_or(serde_json::Value::Null);
    Some(ScheduledRow {
        id,
        session_id,
        kind,
        scheduled_for,
        cron,
        timezone,
        status,
        attempt_count,
        last_error,
        sent_at,
        targets,
        payload,
    })
}

pub async fn update(
    db: &Database,
    scheduled_id: &str,
    scheduled_for: Option<DateTime<Utc>>,
    cron: Option<&str>,
    timezone: Option<&str>,
    payload: Option<&serde_json::Value>,
) -> Result<()> {
    let col = scheduled_doc_collection(db);
    let mut set = bson::Document::new();
    if let Some(s) = scheduled_for {
        set.insert("scheduledFor", Bson::DateTime(s.into()));
    }
    if let Some(c) = cron {
        set.insert("cron", c);
    }
    if let Some(t) = timezone {
        set.insert("timezone", t);
    }
    if let Some(p) = payload {
        set.insert("payload", bson::to_bson(p).unwrap_or(Bson::Null));
    }
    if set.is_empty() {
        return Ok(());
    }
    col.update_one(doc! { "_id": scheduled_id }, doc! { "$set": set })
        .await
        .context("sabwa_scheduled.update (raw)")?;
    Ok(())
}

pub async fn cancel(db: &Database, scheduled_id: &str) -> Result<()> {
    let col = scheduled_doc_collection(db);
    col.update_one(
        doc! { "_id": scheduled_id, "status": "pending" },
        doc! { "$set": { "status": "cancelled" } },
    )
    .await
    .context("sabwa_scheduled.cancel (raw)")?;
    Ok(())
}
