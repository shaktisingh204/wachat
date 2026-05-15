//! Minimal repos for the remaining `sabwa_*` collections listed in
//! SABWA_PLAN.md §3 ("Other collections"). Each gets a thin struct plus a
//! `Repo` with `insert`, `find_by_session`, and `delete_by_id`.
//!
//! These are deliberately lightweight — richer per-collection behaviour can
//! be added later without breaking the cross-module re-exports in
//! `db::mod.rs`.

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Document structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub variables: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaQuickReply {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    /// e.g. `/thanks`
    pub shortcut: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaAutoReply {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub name: String,
    /// Free-form rule descriptor — schema evolves; stored as a sub-document.
    pub trigger: bson::Document,
    pub action: bson::Document,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaBroadcast {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub name: String,
    #[serde(default)]
    pub recipient_jids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaLabel {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub name: String,
    /// Hex colour, e.g. `#2563eb`.
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaWebhook {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub url: String,
    pub secret: String,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaAuditLogEntry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub actor_user_id: ObjectId,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<bson::Document>,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaApiKey {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    /// Optional bound session — left as None for project-wide keys, kept for
    /// backwards compatibility with the earlier session-scoped schema.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<ObjectId>,
    #[serde(default)]
    pub name: String,
    /// SHA-256 (hex) of the raw token — never store the raw key.
    pub key_hash: String,
    /// First 6 chars of the raw key (e.g. `sk_AB`) for safe UI display.
    #[serde(default)]
    pub prefix: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub revoked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub usage_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// Generic repo template — every misc collection needs the same three ops.
// ---------------------------------------------------------------------------

/// Builds the common insert / find-by-session / delete-by-id surface for a
/// `sabwa_*` collection. Each concrete repo monomorphises its document type
/// so error messages and rustdoc render cleanly per collection.
macro_rules! define_misc_repo {
    ($repo:ident, $doc_ty:ty, $coll_const:expr) => {
        pub struct $repo<'a> {
            col: Collection<$doc_ty>,
            _phantom: std::marker::PhantomData<&'a ()>,
        }

        impl<'a> $repo<'a> {
            pub fn new(db: &'a Database) -> Self {
                Self {
                    col: db.collection::<$doc_ty>($coll_const),
                    _phantom: std::marker::PhantomData,
                }
            }

            pub async fn insert(&self, item: &$doc_ty) -> Result<ObjectId> {
                let res = self
                    .col
                    .insert_one(item)
                    .await
                    .with_context(|| format!("{}.insert", $coll_const))?;
                res.inserted_id
                    .as_object_id()
                    .context("inserted_id was not ObjectId")
            }

            pub async fn find_by_session(
                &self,
                session_id: &ObjectId,
            ) -> Result<Vec<$doc_ty>> {
                let cursor = self
                    .col
                    .find(doc! { "sessionId": session_id })
                    .await
                    .with_context(|| format!("{}.find_by_session", $coll_const))?;
                let out: Vec<$doc_ty> = cursor
                    .try_collect()
                    .await
                    .with_context(|| format!("collect {}", $coll_const))?;
                Ok(out)
            }

            pub async fn delete_by_id(&self, id: &ObjectId) -> Result<()> {
                self.col
                    .delete_one(doc! { "_id": id })
                    .await
                    .with_context(|| format!("{}.delete_by_id", $coll_const))?;
                Ok(())
            }

            pub fn collection(db: &Database) -> Collection<$doc_ty>
            where
                $doc_ty: DeserializeOwned + Serialize + Send + Sync,
            {
                db.collection::<$doc_ty>($coll_const)
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
//
// The misc collections use simple string-id rows because the Next.js routes
// drive them; full ObjectId-based repos can land in Phase 2 alongside the
// admin / API-key flows.
// ---------------------------------------------------------------------------

use anyhow::anyhow;
use bson::{Bson, DateTime as BsonDateTime};
use redis::AsyncCommands;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastRow {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub recipient_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignRow {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub status: String,
    pub total: u32,
    pub sent: u32,
    pub failed: u32,
    pub rate_per_minute: Option<u32>,
    pub jitter_seconds: Option<u32>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub payload: serde_json::Value,
}

fn broadcasts_doc_collection(db: &Database) -> Collection<bson::Document> {
    db.collection::<bson::Document>("sabwa_broadcasts")
}

fn campaigns_doc_collection(db: &Database) -> Collection<bson::Document> {
    db.collection::<bson::Document>("sabwa_bulk_campaigns")
}

fn broadcast_doc_to_row(d: bson::Document) -> Option<BroadcastRow> {
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
    let recipient_count = match d.get("recipients") {
        Some(Bson::Array(a)) => a.len() as u32,
        _ => 0,
    };
    let created_at = match d.get("createdAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => Utc::now(),
    };
    let updated_at = match d.get("updatedAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    Some(BroadcastRow {
        id,
        session_id,
        name: d.get_str("name").unwrap_or("").to_string(),
        recipient_count,
        created_at,
        updated_at,
    })
}

fn campaign_doc_to_row(d: bson::Document) -> Option<CampaignRow> {
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
    let payload = d
        .get("payload")
        .cloned()
        .map(|b| b.into_relaxed_extjson())
        .unwrap_or(serde_json::Value::Null);
    Some(CampaignRow {
        id,
        session_id,
        name: d.get_str("name").unwrap_or("").to_string(),
        status: d.get_str("status").unwrap_or("queued").to_string(),
        total: d.get_i32("total").unwrap_or(0).max(0) as u32,
        sent: d.get_i32("sent").unwrap_or(0).max(0) as u32,
        failed: d.get_i32("failed").unwrap_or(0).max(0) as u32,
        rate_per_minute: d
            .get_i32("ratePerMinute")
            .ok()
            .and_then(|v| u32::try_from(v).ok()),
        jitter_seconds: d
            .get_i32("jitterSeconds")
            .ok()
            .and_then(|v| u32::try_from(v).ok()),
        started_at: match d.get("startedAt") {
            Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
            _ => None,
        },
        finished_at: match d.get("finishedAt") {
            Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
            _ => None,
        },
        payload,
    })
}

pub async fn list_broadcasts(db: &Database, session_id: &str) -> Result<Vec<BroadcastRow>> {
    let col = broadcasts_doc_collection(db);
    let cursor = col
        .find(doc! { "sessionId": session_id })
        .await
        .context("sabwa_broadcasts.list")?;
    let docs: Vec<bson::Document> = cursor.try_collect().await.context("collect broadcasts")?;
    Ok(docs.into_iter().filter_map(broadcast_doc_to_row).collect())
}

pub async fn insert_broadcast(
    db: &Database,
    id: &str,
    project_id: &str,
    session_id: &str,
    name: &str,
    recipients: &[String],
) -> Result<()> {
    let col = broadcasts_doc_collection(db);
    let arr: Vec<Bson> = recipients.iter().map(|r| Bson::String(r.clone())).collect();
    let doc = doc! {
        "_id": id,
        "projectId": project_id,
        "sessionId": session_id,
        "name": name,
        "recipients": arr,
        "createdAt": Bson::DateTime(BsonDateTime::now()),
    };
    col.insert_one(doc)
        .await
        .context("sabwa_broadcasts.insert")?;
    Ok(())
}

pub async fn get_broadcast(db: &Database, id: &str) -> Result<BroadcastRow> {
    let col = broadcasts_doc_collection(db);
    let d = col
        .find_one(doc! { "_id": id })
        .await
        .context("sabwa_broadcasts.get")?
        .ok_or_else(|| anyhow!("broadcast not found: {id}"))?;
    broadcast_doc_to_row(d).ok_or_else(|| anyhow!("broadcast row decode failed"))
}

pub async fn update_broadcast(
    db: &Database,
    id: &str,
    name: Option<&str>,
    recipients: Option<&[String]>,
) -> Result<()> {
    let col = broadcasts_doc_collection(db);
    let mut set = bson::Document::new();
    if let Some(n) = name {
        set.insert("name", n);
    }
    if let Some(r) = recipients {
        let arr: Vec<Bson> = r.iter().map(|s| Bson::String(s.clone())).collect();
        set.insert("recipients", arr);
    }
    if set.is_empty() {
        return Ok(());
    }
    set.insert("updatedAt", Bson::DateTime(BsonDateTime::now()));
    col.update_one(doc! { "_id": id }, doc! { "$set": set })
        .await
        .context("sabwa_broadcasts.update")?;
    Ok(())
}

pub async fn delete_broadcast(db: &Database, id: &str) -> Result<()> {
    let col = broadcasts_doc_collection(db);
    col.delete_one(doc! { "_id": id })
        .await
        .context("sabwa_broadcasts.delete")?;
    Ok(())
}

pub async fn insert_campaign(
    db: &Database,
    id: &str,
    project_id: &str,
    session_id: &str,
    name: &str,
    recipients: &[String],
    payload: &serde_json::Value,
    rate_per_minute: Option<u32>,
    jitter_seconds: Option<u32>,
) -> Result<()> {
    let col = campaigns_doc_collection(db);
    let arr: Vec<Bson> = recipients.iter().map(|r| Bson::String(r.clone())).collect();
    let payload_bson = bson::to_bson(payload).unwrap_or(Bson::Null);
    let doc = doc! {
        "_id": id,
        "projectId": project_id,
        "sessionId": session_id,
        "name": name,
        "recipients": arr,
        "payload": payload_bson,
        "status": "queued",
        "total": recipients.len() as i32,
        "sent": 0i32,
        "failed": 0i32,
        "ratePerMinute": rate_per_minute.map(|v| v as i32),
        "jitterSeconds": jitter_seconds.map(|v| v as i32),
        "createdAt": Bson::DateTime(BsonDateTime::now()),
    };
    col.insert_one(doc)
        .await
        .context("sabwa_bulk_campaigns.insert")?;
    Ok(())
}

pub async fn list_campaigns(db: &Database, session_id: &str) -> Result<Vec<CampaignRow>> {
    let col = campaigns_doc_collection(db);
    let cursor = col
        .find(doc! { "sessionId": session_id })
        .await
        .context("sabwa_bulk_campaigns.list")?;
    let docs: Vec<bson::Document> = cursor.try_collect().await.context("collect campaigns")?;
    Ok(docs.into_iter().filter_map(campaign_doc_to_row).collect())
}

pub async fn get_campaign(db: &Database, id: &str) -> Result<CampaignRow> {
    let col = campaigns_doc_collection(db);
    let d = col
        .find_one(doc! { "_id": id })
        .await
        .context("sabwa_bulk_campaigns.get")?
        .ok_or_else(|| anyhow!("campaign not found: {id}"))?;
    campaign_doc_to_row(d).ok_or_else(|| anyhow!("campaign row decode failed"))
}

pub async fn get_campaign_session(db: &Database, id: &str) -> Result<String> {
    let col = campaigns_doc_collection(db);
    let d = col
        .find_one(doc! { "_id": id })
        .await
        .context("sabwa_bulk_campaigns.get_session")?
        .ok_or_else(|| anyhow!("campaign not found: {id}"))?;
    match d.get("sessionId") {
        Some(Bson::String(s)) => Ok(s.clone()),
        Some(Bson::ObjectId(o)) => Ok(o.to_hex()),
        _ => Err(anyhow!("campaign {id} missing sessionId")),
    }
}

/// Thin wrapper around Redis `LPUSH` used by route handlers to enqueue
/// outbound payloads onto a per-session queue.
pub async fn redis_lpush(redis: &redis::Client, key: &str, payload: &str) -> Result<()> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .context("redis connect")?;
    let _: i64 = conn
        .lpush(key, payload)
        .await
        .with_context(|| format!("LPUSH {key}"))?;
    Ok(())
}

define_misc_repo!(TemplatesRepo, SabwaTemplate, "sabwa_templates");
define_misc_repo!(QuickRepliesRepo, SabwaQuickReply, "sabwa_quick_replies");
define_misc_repo!(AutoRepliesRepo, SabwaAutoReply, "sabwa_auto_replies");
define_misc_repo!(BroadcastsRepo, SabwaBroadcast, "sabwa_broadcasts");
define_misc_repo!(LabelsRepo, SabwaLabel, "sabwa_labels");
define_misc_repo!(WebhooksRepo, SabwaWebhook, "sabwa_webhooks");
define_misc_repo!(AuditLogRepo, SabwaAuditLogEntry, "sabwa_audit_log");
define_misc_repo!(ApiKeysRepo, SabwaApiKey, "sabwa_api_keys");

impl<'a> ApiKeysRepo<'a> {
    /// Find a non-deleted key by its SHA-256 hash. Returns `None` on miss so
    /// callers can map that to a 401 without surfacing a not-found error.
    pub async fn find_by_hash(&self, key_hash: &str) -> Result<Option<SabwaApiKey>> {
        let col = self.col.clone();
        col.find_one(doc! { "keyHash": key_hash })
            .await
            .context("sabwa_api_keys.find_by_hash")
    }

    /// Best-effort usage stamp: bumps `lastUsedAt` to now and increments
    /// `usageCount` by 1.
    pub async fn mark_used(&self, id: &ObjectId) -> Result<()> {
        let col = self.col.clone();
        col.update_one(
            doc! { "_id": id },
            doc! {
                "$set": { "lastUsedAt": Bson::DateTime(BsonDateTime::now()) },
                "$inc": { "usageCount": 1i64 },
            },
        )
        .await
        .context("sabwa_api_keys.mark_used")?;
        Ok(())
    }

    /// Soft-revoke — flips `revoked: true` so the row is preserved for audit.
    pub async fn revoke(&self, id: &ObjectId) -> Result<()> {
        let col = self.col.clone();
        col.update_one(
            doc! { "_id": id },
            doc! { "$set": { "revoked": true } },
        )
        .await
        .context("sabwa_api_keys.revoke")?;
        Ok(())
    }

    /// Persist a freshly minted key. The caller is responsible for hashing
    /// the raw token before calling this; we only ever see `key_hash`.
    pub async fn create(&self, key: &SabwaApiKey) -> Result<ObjectId> {
        let col = self.col.clone();
        let res = col
            .insert_one(key)
            .await
            .context("sabwa_api_keys.create")?;
        res.inserted_id
            .as_object_id()
            .context("sabwa_api_keys.create: inserted_id was not ObjectId")
    }

    /// List every key (revoked included) belonging to `project_id`.
    pub async fn list_by_project(&self, project_id: &ObjectId) -> Result<Vec<SabwaApiKey>> {
        let col = self.col.clone();
        let cursor = col
            .find(doc! { "projectId": project_id })
            .await
            .context("sabwa_api_keys.list_by_project")?;
        let out: Vec<SabwaApiKey> = cursor
            .try_collect()
            .await
            .context("collect sabwa_api_keys")?;
        Ok(out)
    }
}
