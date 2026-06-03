//! Send-queue job handler — port of
//! `src/workers/broadcast/send.worker.js`.
//!
//! Each job carries `{ broadcastId, contactIds: [...] }` (up to
//! `BROADCAST_BATCH_SIZE` ids). Per job we:
//!
//!   1. Reload the broadcast doc — pick up cancellation / mps changes.
//!   2. Reload only the contacts that are still PENDING — idempotent
//!      against retries.
//!   3. Run an opt-out lookup against `contacts` (`isOptedOut: true`),
//!      mark those as `FAILED` with `error: 'contact_opted_out'`, do
//!      not call Meta for them.
//!   4. Fan out up to `BROADCAST_BATCH_PARALLEL` parallel sends, each
//!      acquiring 1 token from the per-broadcast Redis bucket
//!      (`wachat_rate_limit::BroadcastLimiter`) before calling Meta.
//!   5. Single `bulkWrite` to `broadcast_contacts`, single `$inc` to
//!      `broadcasts`, and single `insertMany` to `outgoing_messages`
//!      per batch — mirrors the 3 round-trip layout the Node worker
//!      uses at lines 393-414.
//!   6. Re-enqueue retryable contacts as a new send-batch job with
//!      `delay = max(RETRY_DELAY_MS, max_retry_after_ms)`.
//!   7. Try to finalize the broadcast (PROCESSING → Completed) when
//!      `successCount + errorCount >= contactCount`.

use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::{StreamExt, TryStreamExt, stream};
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, error, info, warn};
use wachat_queue::{BullProducer, JobOptions};
use wachat_rate_limit::{AcquireResult, BroadcastLimiter};

use crate::classify::{ErrorKind, classify_error};
use crate::interpolate::{
    ContactRef, FlowContext, TemplateContext, build_flow_payload, build_template_payload,
};
use crate::queue_compat::{BullJob, JobHandler, JobOutcome};

const BROADCASTS_COLL: &str = "broadcasts";
const BROADCAST_CONTACTS_COLL: &str = "broadcast_contacts";
const CONTACTS_COLL: &str = "contacts";
const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";
const SEND_QUEUE: &str = "broadcast-send";
const SEND_JOB: &str = "send-batch";

/// Hard cap on a single rate-limit acquire wait — matches the Node
/// `acquireTokens` implementation. Beyond this we surface a transient
/// failure rather than block forever.
const ACQUIRE_HARD_DEADLINE: Duration = Duration::from_secs(5 * 60);
const ACQUIRE_MAX_SLEEP_MS: u64 = 2_000;

/// Tunables for the send handler. Field names mirror env vars on the
/// binary side (`BROADCAST_BATCH_PARALLEL`, ...).
#[derive(Debug, Clone)]
pub struct SendConfig {
    /// Max in-flight per-contact sends per batch. Default: 64.
    pub parallel: usize,
    /// Max per-contact retry count (across re-enqueues). Default: 3.
    pub max_retries: u32,
    /// Floor for re-enqueue delay when nothing else asks for longer.
    /// Default: 5_000 ms.
    pub retry_delay_ms: u64,
    /// Default messages-per-second when neither the broadcast nor the
    /// project specifies one. Default: 80.
    pub default_mps: u32,
    /// Meta Graph API version. Default: `v23.0`.
    pub api_version: String,
}

impl Default for SendConfig {
    fn default() -> Self {
        Self {
            parallel: 64,
            max_retries: 3,
            retry_delay_ms: 5_000,
            default_mps: 80,
            api_version: "v23.0".to_owned(),
        }
    }
}

/// Job handler for the `broadcast-send` queue. Cheap to clone.
#[derive(Clone)]
pub struct SendJobHandler {
    mongo: MongoHandle,
    bull: BullProducer,
    limiter: BroadcastLimiter,
    http: reqwest::Client,
    cfg: SendConfig,
}

impl SendJobHandler {
    pub fn new(
        mongo: MongoHandle,
        bull: BullProducer,
        limiter: BroadcastLimiter,
        http: reqwest::Client,
        cfg: SendConfig,
    ) -> Self {
        Self {
            mongo,
            bull,
            limiter,
            http,
            cfg,
        }
    }
}

#[async_trait]
impl JobHandler for SendJobHandler {
    async fn process(&self, job: &BullJob) -> Result<JobOutcome> {
        let broadcast_id_str = job
            .data
            .get("broadcastId")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("send job missing data.broadcastId"))?;
        let broadcast_id = ObjectId::parse_str(broadcast_id_str)
            .map_err(|e| anyhow!("invalid broadcastId `{broadcast_id_str}`: {e}"))?;

        let contact_ids: Vec<ObjectId> = job
            .data
            .get("contactIds")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| ObjectId::parse_str(s).ok())
                    .collect()
            })
            .unwrap_or_default();

        match self.run(broadcast_id, contact_ids).await {
            Ok(outcome) => Ok(JobOutcome::Completed(outcome)),
            Err(err) => {
                error!(
                    broadcast_id = %broadcast_id.to_hex(),
                    error = ?err,
                    "send handler failed"
                );
                Ok(JobOutcome::Failed {
                    error: err.to_string(),
                })
            }
        }
    }
}

/// Outcome of a single per-contact Meta send.
struct SendAttempt {
    contact: BroadcastContact,
    result: SendResult,
}

enum SendResult {
    Ok {
        wamid: String,
        sent_payload: Value,
    },
    Err {
        kind: ErrorKind,
        error: String,
        retry_after_ms: Option<u64>,
    },
}

/// Subset of `broadcast_contacts` we materialize per row.
#[derive(Debug, Clone)]
struct BroadcastContact {
    id: ObjectId,
    phone: String,
    name: Option<String>,
    variables: Value,
    attempts: u32,
}

impl BroadcastContact {
    fn from_doc(d: Document) -> Result<Self> {
        let id = d
            .get_object_id("_id")
            .map_err(|_| anyhow!("broadcast_contact missing _id"))?;
        let phone = d.get_str("phone").map(|s| s.to_owned()).unwrap_or_default();
        let name = d.get_str("name").ok().map(|s| s.to_owned());
        let attempts = d
            .get_i32("attempts")
            .map(|n| n as u32)
            .or_else(|_| d.get_i64("attempts").map(|n| n as u32))
            .unwrap_or(0);
        // `variables` may be a sub-doc or absent.
        let variables = match d.get("variables") {
            Some(b) => bson_to_json(b.clone()),
            None => Value::Object(Default::default()),
        };
        Ok(Self {
            id,
            phone,
            name,
            variables,
            attempts,
        })
    }
}

/// Best-effort BSON → JSON. We only care about scalar / object shapes
/// for variable substitution; binary / decimal fall back to null which
/// the interpolator treats as missing.
fn bson_to_json(b: Bson) -> Value {
    match b {
        Bson::Null => Value::Null,
        Bson::Boolean(v) => Value::Bool(v),
        Bson::String(s) => Value::String(s),
        Bson::Int32(n) => Value::Number(n.into()),
        Bson::Int64(n) => Value::Number(n.into()),
        Bson::Double(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::Document(d) => {
            let mut m = serde_json::Map::new();
            for (k, v) in d {
                m.insert(k, bson_to_json(v));
            }
            Value::Object(m)
        }
        Bson::Array(arr) => Value::Array(arr.into_iter().map(bson_to_json).collect()),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => Value::String(dt.try_to_rfc3339_string().unwrap_or_default()),
        _ => Value::Null,
    }
}

impl SendJobHandler {
    async fn run(&self, broadcast_id: ObjectId, contact_ids: Vec<ObjectId>) -> Result<Value> {
        let broadcasts = self.mongo.collection::<Document>(BROADCASTS_COLL);
        let bcontacts = self.mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
        let crm_contacts = self.mongo.collection::<Document>(CONTACTS_COLL);

        // ---- 1. Reload broadcast + status guards ---------------------
        let Some(broadcast) = broadcasts
            .find_one(doc! { "_id": broadcast_id })
            .await
            .context("broadcasts.find_one")?
        else {
            return Ok(json!({ "skipped": true, "reason": "not-found" }));
        };

        if broadcast.get_str("status").unwrap_or("") == "Cancelled" {
            return Ok(json!({ "skipped": true, "reason": "cancelled" }));
        }

        let project_id = broadcast
            .get_object_id("projectId")
            .map_err(|_| anyhow!("broadcast.projectId missing"))?;
        let phone_number_id = broadcast
            .get_str("phoneNumberId")
            .map_err(|_| anyhow!("broadcast.phoneNumberId missing"))?
            .to_owned();
        let access_token = broadcast
            .get_str("accessToken")
            .map_err(|_| anyhow!("broadcast.accessToken missing"))?
            .to_owned();

        let contact_count = broadcast
            .get_i32("contactCount")
            .map(|n| n as i64)
            .or_else(|_| broadcast.get_i64("contactCount"))
            .unwrap_or(0);

        // ---- 2. Reload PENDING contacts ------------------------------
        let mut pending: Vec<BroadcastContact> = Vec::new();
        if !contact_ids.is_empty() {
            let mut cursor = bcontacts
                .find(doc! {
                    "_id": { "$in": contact_ids.clone() },
                    "status": "PENDING",
                })
                .await
                .context("broadcast_contacts.find PENDING")?;
            while let Some(d) = cursor
                .try_next()
                .await
                .context("broadcast_contacts cursor advance")?
            {
                pending.push(BroadcastContact::from_doc(d)?);
            }
        }
        if pending.is_empty() {
            return Ok(json!({ "processed": 0, "reason": "all-already-processed" }));
        }

        // ---- 3. Opt-out lookup ---------------------------------------
        let phones: Vec<String> = pending
            .iter()
            .map(|c| c.phone.clone())
            .filter(|p| !p.is_empty())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let mut opted_out: HashSet<String> = HashSet::new();
        if !phones.is_empty() {
            match crm_contacts
                .find(doc! {
                    "projectId": project_id,
                    "waId": { "$in": &phones },
                    "isOptedOut": true,
                })
                .with_options(
                    mongodb::options::FindOptions::builder()
                        .projection(doc! { "waId": 1 })
                        .build(),
                )
                .await
            {
                Ok(mut cur) => {
                    while let Ok(Some(d)) = cur.try_next().await {
                        if let Ok(s) = d.get_str("waId") {
                            opted_out.insert(s.to_owned());
                        }
                    }
                }
                Err(e) => warn!(error = %e, "opt-out lookup failed; proceeding"),
            }
        }

        // Split pending into (sendable, opted-out).
        let mut sendable: Vec<BroadcastContact> = Vec::with_capacity(pending.len());
        let mut opt_out_ops: Vec<Document> = Vec::new();
        for c in pending {
            if opted_out.contains(&c.phone) {
                opt_out_ops.push(doc! {
                    "updateOne": {
                        "filter": { "_id": c.id },
                        "update": {
                            "$set": {
                                "status": "FAILED",
                                "error": "contact_opted_out",
                                "sentAt": bson::DateTime::from_chrono(Utc::now()),
                            }
                        }
                    }
                });
            } else {
                sendable.push(c);
            }
        }

        if !opt_out_ops.is_empty() {
            let n = opt_out_ops.len() as i64;
            // Mongo's bulkWrite via the Rust driver isn't yet stable in
            // 3.x's typed Collection API for arbitrary `WriteModel`s,
            // so issue the updates as individual update_one calls
            // serially. Volume here is bounded by `BROADCAST_BATCH_SIZE`
            // (default 200) so this is at most a few hundred small ops.
            let _ = bulk_apply_opt_out_updates(&bcontacts, &opt_out_ops).await;
            let _ = broadcasts
                .update_one(
                    doc! { "_id": broadcast_id },
                    doc! { "$inc": { "errorCount": n } },
                )
                .await;
            info!(
                broadcast_id = %broadcast_id.to_hex(),
                count = n,
                "skipped opted-out recipients"
            );
        }

        if sendable.is_empty() {
            self.try_finalize(broadcast_id, contact_count).await;
            return Ok(json!({ "processed": 0, "reason": "all-opted-out" }));
        }

        // ---- 4. Build the per-broadcast send context -----------------
        let broadcast_type = broadcast
            .get_str("broadcastType")
            .unwrap_or("template")
            .to_owned();
        let mps = resolve_mps(&broadcast, self.cfg.default_mps);

        let template_ctx = if broadcast_type != "flow" {
            Some(TemplateContext {
                template_name: broadcast.get_str("templateName").unwrap_or("").to_owned(),
                language: broadcast.get_str("language").unwrap_or("en_US").to_owned(),
                components: broadcast
                    .get_array("components")
                    .map(|arr| arr.iter().cloned().map(bson_to_json).collect())
                    .unwrap_or_default(),
                header_media_id: broadcast
                    .get_str("headerMediaId")
                    .ok()
                    .map(|s| s.to_owned()),
                header_media_type: broadcast
                    .get_str("headerMediaType")
                    .ok()
                    .map(|s| s.to_owned()),
                global_body_vars: broadcast
                    .get_document("globalBodyVars")
                    .ok()
                    .map(|d| bson_to_json(Bson::Document(d.clone()))),
            })
        } else {
            None
        };

        let flow_ctx = if broadcast_type == "flow" {
            Some(FlowContext {
                flow_meta_id: broadcast
                    .get_str("flowMetaId")
                    .map_err(|_| anyhow!("flow broadcast missing flowMetaId"))?
                    .to_owned(),
                flow_name: broadcast.get_str("flowName").ok().map(|s| s.to_owned()),
                flow_config: broadcast
                    .get_document("flowConfig")
                    .ok()
                    .map(|d| bson_to_json(Bson::Document(d.clone()))),
            })
        } else {
            None
        };

        // ---- 5. Fan out per-contact sends ----------------------------
        let id_hex = broadcast_id.to_hex();
        let parallel = self.cfg.parallel.min((mps as usize) * 2).max(1);
        let send_url = format!(
            "https://graph.facebook.com/{}/{}/messages",
            self.cfg.api_version, phone_number_id
        );

        let attempts: Vec<SendAttempt> = stream::iter(sendable.into_iter())
            .map(|contact| {
                let limiter = self.limiter.clone();
                let http = self.http.clone();
                let id_hex = id_hex.clone();
                let template_ctx = template_ctx.clone();
                let flow_ctx = flow_ctx.clone();
                let send_url = send_url.clone();
                let access_token = access_token.clone();
                async move {
                    // Block until we have a token for this broadcast.
                    if let Err(e) = acquire_blocking(&limiter, &id_hex, mps).await {
                        return SendAttempt {
                            contact,
                            result: SendResult::Err {
                                kind: ErrorKind::Transient,
                                error: format!("rate-limit acquire: {e}"),
                                retry_after_ms: None,
                            },
                        };
                    }
                    let result = send_one(
                        &http,
                        &send_url,
                        &access_token,
                        &contact,
                        template_ctx.as_ref(),
                        flow_ctx.as_ref(),
                    )
                    .await;
                    SendAttempt { contact, result }
                }
            })
            .buffer_unordered(parallel)
            .collect()
            .await;

        // ---- 6. Bulk write results -----------------------------------
        let mut bulk_ops: Vec<Document> = Vec::new();
        let mut success_results: Vec<(BroadcastContact, String, Value)> = Vec::new();
        let mut retry_ids: Vec<ObjectId> = Vec::new();
        let mut success = 0_i64;
        let mut failed = 0_i64;
        let mut max_retry_after_ms: u64 = 0;

        for SendAttempt { contact, result } in attempts {
            match result {
                SendResult::Ok {
                    wamid,
                    sent_payload,
                } => {
                    success += 1;
                    bulk_ops.push(doc! {
                        "updateOne": {
                            "filter": { "_id": contact.id },
                            "update": {
                                "$set": {
                                    "status": "SENT",
                                    "sentAt": bson::DateTime::from_chrono(Utc::now()),
                                    "messageId": &wamid,
                                    "error": null,
                                }
                            }
                        }
                    });
                    success_results.push((contact, wamid, sent_payload));
                }
                SendResult::Err {
                    kind,
                    error,
                    retry_after_ms,
                } => {
                    let new_attempts = contact.attempts + 1;
                    if matches!(kind, ErrorKind::Permanent) || new_attempts >= self.cfg.max_retries
                    {
                        failed += 1;
                        let final_err = if matches!(kind, ErrorKind::Permanent) {
                            error
                        } else {
                            format!("Max retries ({new_attempts}): {error}")
                        };
                        bulk_ops.push(doc! {
                            "updateOne": {
                                "filter": { "_id": contact.id },
                                "update": {
                                    "$set": {
                                        "status": "FAILED",
                                        "error": final_err,
                                        "attempts": new_attempts as i32,
                                    }
                                }
                            }
                        });
                    } else {
                        retry_ids.push(contact.id);
                        bulk_ops.push(doc! {
                            "updateOne": {
                                "filter": { "_id": contact.id },
                                "update": {
                                    "$set": {
                                        "attempts": new_attempts as i32,
                                        "lastError": error,
                                    }
                                }
                            }
                        });
                        if let Some(ms) = retry_after_ms {
                            if ms > max_retry_after_ms {
                                max_retry_after_ms = ms;
                            }
                        }
                    }
                }
            }
        }

        if !bulk_ops.is_empty() {
            let _ = bulk_apply_opt_out_updates(&bcontacts, &bulk_ops).await;
        }

        if !success_results.is_empty() {
            self.sync_successful_sends(&broadcast, &success_results)
                .await;
        }

        if success > 0 || failed > 0 {
            let _ = broadcasts
                .update_one(
                    doc! { "_id": broadcast_id },
                    doc! {
                        "$inc": {
                            "successCount": success,
                            "errorCount": failed,
                        }
                    },
                )
                .await;
        }

        // ---- 7. Re-enqueue retryable contacts ------------------------
        let retried = retry_ids.len();
        if !retry_ids.is_empty() {
            let delay = self.cfg.retry_delay_ms.max(max_retry_after_ms);
            let payload = json!({
                "broadcastId": broadcast_id.to_hex(),
                "contactIds": retry_ids
                    .iter()
                    .map(|i| i.to_hex())
                    .collect::<Vec<_>>(),
            });
            let opts = JobOptions {
                priority: Some(1_000),
                delay_ms: Some(delay),
                ..Default::default()
            };
            if let Err(e) = self.bull.add(SEND_QUEUE, SEND_JOB, &payload, opts).await {
                warn!(error = ?e, "failed to re-enqueue retry batch");
            }
        }

        // ---- 8. Try to finalize --------------------------------------
        self.try_finalize(broadcast_id, contact_count).await;

        Ok(json!({
            "sent": success,
            "failed": failed,
            "retried": retried,
        }))
    }

    /// CRM `contacts` upsert / update + `outgoing_messages` insert per
    /// successful send. Mirrors `syncSuccessfulSends` (lines 77-197).
    async fn sync_successful_sends(
        &self,
        broadcast: &Document,
        results: &[(BroadcastContact, String, Value)],
    ) {
        if results.is_empty() {
            return;
        }
        let project_id = match broadcast.get_object_id("projectId") {
            Ok(p) => p,
            Err(_) => return,
        };
        let now = Utc::now();
        let bson_now = bson::DateTime::from_chrono(now);

        let create_contacts = broadcast.get_bool("createContacts").unwrap_or(false);
        let broadcast_type = broadcast
            .get_str("broadcastType")
            .unwrap_or("template")
            .to_owned();
        let template_name = broadcast.get_str("templateName").unwrap_or("").to_owned();
        let flow_name = broadcast.get_str("flowName").unwrap_or("").to_owned();
        let phone_number_id = broadcast.get_str("phoneNumberId").unwrap_or("").to_owned();

        let last_message = if broadcast_type == "flow" {
            format!(
                "[Flow]: {}",
                if !flow_name.is_empty() {
                    &flow_name
                } else {
                    &template_name
                }
            )
        } else {
            format!("[Template]: {template_name}")
        };
        let last_message: String = last_message.chars().take(50).collect();

        // Resolve unique phones → contact ObjectId.
        let mut phone_to_id: HashMap<String, ObjectId> = HashMap::new();
        let mut unique_phones: HashMap<String, &BroadcastContact> = HashMap::new();
        for (c, _, _) in results {
            if !c.phone.is_empty() {
                unique_phones.entry(c.phone.clone()).or_insert(c);
            }
        }

        let crm = self.mongo.collection::<Document>(CONTACTS_COLL);
        if create_contacts {
            for (phone, c) in &unique_phones {
                let name = c.name.clone().unwrap_or_else(|| {
                    let suffix: String = phone
                        .chars()
                        .rev()
                        .take(4)
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect();
                    format!("User ({suffix})")
                });
                let opts = FindOneAndUpdateOptions::builder()
                    .upsert(true)
                    .return_document(ReturnDocument::After)
                    .build();
                let res = crm
                    .find_one_and_update(
                        doc! { "projectId": project_id, "waId": phone },
                        doc! {
                            "$setOnInsert": {
                                "projectId": project_id,
                                "phoneNumberId": &phone_number_id,
                                "name": name,
                                "waId": phone,
                                "createdAt": bson_now,
                                "status": "open",
                                "source": "broadcast",
                            },
                            "$set": {
                                "lastMessage": &last_message,
                                "lastMessageTimestamp": bson_now,
                            },
                        },
                    )
                    .with_options(opts)
                    .await;
                match res {
                    Ok(Some(d)) => {
                        if let Ok(id) = d.get_object_id("_id") {
                            phone_to_id.insert(phone.clone(), id);
                        }
                    }
                    Ok(None) => {}
                    Err(e) => warn!(error = %e, %phone, "contact upsert failed"),
                }
            }
        } else {
            // Only update lastMessage for EXISTING contacts.
            let phones: Vec<&String> = unique_phones.keys().collect();
            if !phones.is_empty() {
                let _ = crm
                    .update_many(
                        doc! {
                            "projectId": project_id,
                            "waId": { "$in": &phones },
                        },
                        doc! {
                            "$set": {
                                "lastMessage": &last_message,
                                "lastMessageTimestamp": bson_now,
                            }
                        },
                    )
                    .await;
                if let Ok(mut cur) = crm
                    .find(doc! {
                        "projectId": project_id,
                        "waId": { "$in": &phones },
                    })
                    .with_options(
                        mongodb::options::FindOptions::builder()
                            .projection(doc! { "_id": 1, "waId": 1 })
                            .build(),
                    )
                    .await
                {
                    while let Ok(Some(d)) = cur.try_next().await {
                        if let (Ok(oid), Ok(wa)) = (d.get_object_id("_id"), d.get_str("waId")) {
                            phone_to_id.insert(wa.to_owned(), oid);
                        }
                    }
                }
            }
        }

        // Build outgoing_messages rows.
        let campaign_name: Option<String> = if broadcast_type == "flow" {
            broadcast
                .get_str("flowName")
                .ok()
                .or_else(|| broadcast.get_str("templateName").ok())
                .map(|s| s.to_owned())
        } else {
            broadcast.get_str("templateName").ok().map(|s| s.to_owned())
        };

        let broadcast_oid = broadcast.get_object_id("_id").ok();
        let mut outgoing_docs: Vec<Document> = Vec::with_capacity(results.len());
        for (c, wamid, sent_payload) in results {
            let Some(contact_id) = phone_to_id.get(&c.phone).copied() else {
                continue;
            };
            let is_flow = broadcast_type == "flow";
            let kind = if is_flow { "interactive" } else { "template" };
            // Wrap the sent_payload sub-object under its kind.
            let content_doc = if is_flow {
                doc! { "interactive": serde_json_to_bson(sent_payload.clone()) }
            } else {
                doc! { "template": serde_json_to_bson(sent_payload.clone()) }
            };

            let mut d = doc! {
                "direction": "out",
                "contactId": contact_id,
                "projectId": project_id,
                "wamid": wamid,
                "messageTimestamp": bson_now,
                "type": kind,
                "content": content_doc,
                "status": "sent",
                "statusTimestamps": { "sent": bson_now },
                "createdAt": bson_now,
                "sourceType": "broadcast",
            };
            if let Some(b_id) = broadcast_oid {
                d.insert("broadcastId", b_id);
            }
            if let Some(ref name) = campaign_name {
                d.insert("campaignName", name.clone());
            } else {
                d.insert("campaignName", Bson::Null);
            }
            outgoing_docs.push(d);
        }

        if !outgoing_docs.is_empty() {
            let coll = self.mongo.collection::<Document>(OUTGOING_MESSAGES_COLL);
            let opts = mongodb::options::InsertManyOptions::builder()
                .ordered(false)
                .build();
            if let Err(e) = coll.insert_many(outgoing_docs).with_options(opts).await {
                warn!(error = %e, "outgoing_messages insert_many failed");
            }
        }
    }

    /// Atomically flip a still-PROCESSING broadcast to `Completed` once
    /// `successCount + errorCount >= contactCount`. Mirrors
    /// `tryFinalize` (lines 199-217).
    async fn try_finalize(&self, broadcast_id: ObjectId, contact_count_hint: i64) {
        let coll = self.mongo.collection::<Document>(BROADCASTS_COLL);
        let Ok(Some(fresh)) = coll
            .find_one(doc! { "_id": broadcast_id })
            .with_options(
                mongodb::options::FindOneOptions::builder()
                    .projection(doc! {
                        "successCount": 1,
                        "errorCount": 1,
                        "status": 1,
                        "contactCount": 1,
                    })
                    .build(),
            )
            .await
        else {
            return;
        };
        if fresh.get_str("status").unwrap_or("") != "PROCESSING" {
            return;
        }
        let expected = fresh
            .get_i32("contactCount")
            .map(|n| n as i64)
            .or_else(|_| fresh.get_i64("contactCount"))
            .unwrap_or(contact_count_hint);
        let success = fresh
            .get_i32("successCount")
            .map(|n| n as i64)
            .or_else(|_| fresh.get_i64("successCount"))
            .unwrap_or(0);
        let error = fresh
            .get_i32("errorCount")
            .map(|n| n as i64)
            .or_else(|_| fresh.get_i64("errorCount"))
            .unwrap_or(0);
        if success + error < expected {
            return;
        }
        let _ = coll
            .update_one(
                doc! { "_id": broadcast_id, "status": "PROCESSING" },
                doc! {
                    "$set": {
                        "status": "Completed",
                        "completedAt": bson::DateTime::from_chrono(Utc::now()),
                    }
                },
            )
            .await;
    }
}

/// Resolve the per-broadcast MPS the same way the Node code does:
/// `messagesPerSecond || projectMessagesPerSecond || DEFAULT_MPS`,
/// clamped to >= 1.
fn resolve_mps(broadcast: &Document, default: u32) -> u32 {
    let from_broadcast = broadcast
        .get_i32("messagesPerSecond")
        .map(|n| n as u32)
        .or_else(|_| broadcast.get_i64("messagesPerSecond").map(|n| n as u32))
        .ok();
    let from_project = broadcast
        .get_i32("projectMessagesPerSecond")
        .map(|n| n as u32)
        .or_else(|_| {
            broadcast
                .get_i64("projectMessagesPerSecond")
                .map(|n| n as u32)
        })
        .ok();
    let resolved = from_broadcast
        .filter(|n| *n > 0)
        .or(from_project.filter(|n| *n > 0))
        .unwrap_or(default);
    resolved.max(1)
}

/// Block until the broadcast's per-broadcast bucket has 1 token or the
/// hard 5-minute deadline elapses. Mirrors the Node `acquireTokens`
/// helper in `src/workers/broadcast/rate-limiter.js`.
async fn acquire_blocking(
    limiter: &BroadcastLimiter,
    broadcast_id_hex: &str,
    mps: u32,
) -> Result<()> {
    let start = Instant::now();
    loop {
        let res = limiter
            .try_send(broadcast_id_hex, mps)
            .await
            .map_err(|e| anyhow!("limiter error: {e}"))?;
        match res {
            AcquireResult::Granted => return Ok(()),
            AcquireResult::Denied { retry_after_ms } => {
                let sleep = retry_after_ms.clamp(1, ACQUIRE_MAX_SLEEP_MS);
                tokio::time::sleep(Duration::from_millis(sleep)).await;
                if start.elapsed() >= ACQUIRE_HARD_DEADLINE {
                    return Err(anyhow!(
                        "Token bucket starvation for broadcast {broadcast_id_hex} (mps={mps})"
                    ));
                }
            }
        }
    }
}

/// Single-message Meta send. Builds the payload, POSTs, and classifies
/// the response. Mirrors `sendWhatsAppMessage` in `send-message.js`.
async fn send_one(
    http: &reqwest::Client,
    url: &str,
    access_token: &str,
    contact: &BroadcastContact,
    template_ctx: Option<&TemplateContext>,
    flow_ctx: Option<&FlowContext>,
) -> SendResult {
    let id_hex = contact.id.to_hex();
    let cref = ContactRef {
        id_hex: &id_hex,
        phone: &contact.phone,
        variables: &contact.variables,
    };
    let (payload, sent_payload) = if let Some(fc) = flow_ctx {
        build_flow_payload(fc, &cref)
    } else if let Some(tc) = template_ctx {
        build_template_payload(tc, &cref)
    } else {
        return SendResult::Err {
            kind: ErrorKind::Permanent,
            error: "Payload build failed: no template/flow context".into(),
            retry_after_ms: None,
        };
    };

    let resp_result = http
        .post(url)
        .bearer_auth(access_token)
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(Duration::from_secs(30))
        .send()
        .await;

    let resp = match resp_result {
        Ok(r) => r,
        Err(e) => {
            return SendResult::Err {
                kind: ErrorKind::Transient,
                error: format!("Network: {e}"),
                retry_after_ms: None,
            };
        }
    };

    let status = resp.status().as_u16();
    let retry_after_ms = resp
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .map(|secs| secs.saturating_mul(1_000));
    let body_text = resp.text().await.unwrap_or_default();

    let body_json: Result<Value, _> = serde_json::from_str(&body_text);
    let body = match body_json {
        Ok(v) => v,
        Err(_) => {
            let kind = if status >= 500 {
                ErrorKind::Transient
            } else {
                ErrorKind::Permanent
            };
            return SendResult::Err {
                kind,
                error: format!(
                    "Non-JSON ({status}): {}",
                    body_text.chars().take(200).collect::<String>()
                ),
                retry_after_ms,
            };
        }
    };

    let messages_id = body
        .get("messages")
        .and_then(|v| v.get(0))
        .and_then(|m| m.get("id"))
        .and_then(Value::as_str);

    if status >= 400 || messages_id.is_none() {
        let api_err = body.get("error");
        let api_code: Option<i64> = api_err.and_then(|e| e.get("code")).and_then(|c| c.as_i64());
        let kind = classify_error(status, api_code);
        let mut message = String::new();
        if let Some(e) = api_err.and_then(|v| v.as_object()) {
            if let Some(t) = e.get("error_user_title").and_then(Value::as_str) {
                let m = e
                    .get("error_user_msg")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                message.push_str(&format!("{t}: {m}"));
            } else if let Some(m) = e.get("message").and_then(Value::as_str) {
                message.push_str(m);
            } else {
                message.push_str(&serde_json::to_string(e).unwrap_or_default());
            }
            if let Some(code) = api_code {
                message.push_str(&format!(" (Code: {code})"));
            }
            if let Some(trace) = e.get("fbtrace_id").and_then(Value::as_str) {
                message.push_str(&format!(" (Trace: {trace})"));
            }
        } else {
            message.push_str(&format!(
                "Meta API error ({status}): {}",
                serde_json::to_string(&body)
                    .unwrap_or_default()
                    .chars()
                    .take(300)
                    .collect::<String>()
            ));
        }
        return SendResult::Err {
            kind,
            error: message,
            retry_after_ms,
        };
    }

    SendResult::Ok {
        wamid: messages_id.unwrap().to_owned(),
        sent_payload,
    }
}

/// Apply a list of `updateOne` ops as individual updates against the
/// `broadcast_contacts` collection. We avoid the typed `bulk_write` API
/// because mongodb 3.x's typed `BulkWriteOperation` shape is in flux —
/// instead we fan the per-row `update_one` calls out concurrently with
/// a bounded buffer so a 200-contact batch costs ~one round trip's worth
/// of wall-clock time, not 200. Pool size (default 60) is the ceiling.
async fn bulk_apply_opt_out_updates(
    coll: &mongodb::Collection<Document>,
    ops: &[Document],
) -> Result<()> {
    use futures::stream::{self, StreamExt};

    const PARALLELISM: usize = 32;

    stream::iter(ops.iter().filter_map(|op| {
        let update_one = op.get_document("updateOne").ok()?;
        let filter = update_one.get_document("filter").ok()?.clone();
        let update = update_one.get_document("update").ok()?.clone();
        Some((filter, update))
    }))
    .for_each_concurrent(PARALLELISM, |(filter, update)| async move {
        if let Err(e) = coll.update_one(filter, update).await {
            debug!(error = %e, "broadcast_contacts.update_one failed (best-effort)");
        }
    })
    .await;
    Ok(())
}

/// Convert a `serde_json::Value` to `Bson` for nesting under
/// `outgoing_messages.content.{template|interactive}`. Falls back to
/// `Bson::Null` on the rare value `bson::to_bson` rejects (NaN floats,
/// non-string map keys — neither is produced by our payload builders).
fn serde_json_to_bson(v: Value) -> Bson {
    bson::to_bson(&v).unwrap_or(Bson::Null)
}
