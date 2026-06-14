//! Control-queue job handler — port of
//! `src/workers/broadcast/control.worker.js`.
//!
//! One job per broadcast. The handler:
//!
//!   1. Loads the broadcast doc and short-circuits if it's already
//!      Completed / Cancelled / FAILED_PROCESSING.
//!   2. Idempotently flips the broadcast to `PROCESSING`, recording the
//!      worker id and pickup time.
//!   3. One-shot uploads any header media to Meta (skipped if
//!      `headerMediaId` is already set — survives crash recovery).
//!   4. Streams `broadcast_contacts` by `_id` ascending, batching ids
//!      into `BROADCAST_BATCH_SIZE` chunks and enqueuing each chunk as
//!      a `send-batch` job on `broadcast-send`.
//!   5. Checkpoints `lastEnqueuedContactId` every `CHECKPOINT_EVERY`
//!      batches so a mid-flight crash resumes from where it left off
//!      instead of double-enqueueing.
//!   6. Re-reads `broadcast.status` every `CANCEL_CHECK_EVERY` batches
//!      and short-circuits on `Cancelled`.

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, error, info, warn};
use wachat_queue::{BullProducer, JobOptions};

use crate::media::upload_header_media_if_needed;
use crate::queue_compat::{BullJob, JobHandler, JobOutcome};

/// BullMQ queue names — must match
/// `src/workers/broadcast/queue.js` and `wachat-broadcast` exactly.
const BROADCASTS_COLL: &str = "broadcasts";
const BROADCAST_CONTACTS_COLL: &str = "broadcast_contacts";
const BROADCAST_LOGS_COLL: &str = "broadcast_logs";
const SEND_QUEUE: &str = "broadcast-send";
const SEND_JOB: &str = "send-batch";

/// Tunables for the control handler. Field names mirror the env vars
/// the binary reads (`BROADCAST_BATCH_SIZE`, ...).
#[derive(Debug, Clone)]
pub struct ControlConfig {
    /// Batch size handed to `enqueue_batch`. Default: 200.
    pub batch_size: usize,
    /// Checkpoint cadence: persist `lastEnqueuedContactId` every N
    /// batches. Default: 10.
    pub checkpoint_every: usize,
    /// Cancellation poll cadence: re-read `broadcast.status` every N
    /// batches. Default: 50.
    pub cancel_check_every: usize,
    /// Meta Graph API version used for the header media upload.
    pub api_version: String,
}

impl Default for ControlConfig {
    fn default() -> Self {
        Self {
            batch_size: 200,
            checkpoint_every: 10,
            cancel_check_every: 50,
            api_version: "v25.0".to_owned(),
        }
    }
}

/// Job handler for the `broadcast-control` queue. Cheap to clone (all
/// fields are `Arc` / `Clone`).
#[derive(Clone)]
pub struct ControlJobHandler {
    mongo: MongoHandle,
    bull: BullProducer,
    http: reqwest::Client,
    cfg: ControlConfig,
    /// Worker identifier used for `controlWorkerId` on the broadcast
    /// doc. Defaults to `format!("rust-{pid}")` in the binary.
    worker_id: String,
}

impl ControlJobHandler {
    pub fn new(
        mongo: MongoHandle,
        bull: BullProducer,
        http: reqwest::Client,
        cfg: ControlConfig,
        worker_id: impl Into<String>,
    ) -> Self {
        Self {
            mongo,
            bull,
            http,
            cfg,
            worker_id: worker_id.into(),
        }
    }
}

#[async_trait]
impl JobHandler for ControlJobHandler {
    async fn process(&self, job: &BullJob) -> Result<JobOutcome> {
        let broadcast_id_str = job
            .data
            .get("broadcastId")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("control job missing data.broadcastId"))?;

        let broadcast_id = ObjectId::parse_str(broadcast_id_str)
            .map_err(|e| anyhow!("invalid broadcastId `{broadcast_id_str}`: {e}"))?;

        let result = self.run(broadcast_id).await;
        match result {
            Ok(outcome) => Ok(JobOutcome::Completed(outcome)),
            Err(err) => {
                error!(
                    broadcast_id = %broadcast_id.to_hex(),
                    error = ?err,
                    "control handler failed"
                );
                Ok(JobOutcome::Failed {
                    error: err.to_string(),
                })
            }
        }
    }
}

impl ControlJobHandler {
    /// Real workhorse — runs the cursor and fans out batches. Errors here
    /// flow up to `process` and become `JobOutcome::Failed` so BullMQ's
    /// per-job retry logic kicks in (the queue is configured with
    /// `attempts: 5, backoff: exponential` over on the producer side).
    async fn run(&self, broadcast_id: ObjectId) -> Result<Value> {
        let broadcasts = self.mongo.collection::<Document>(BROADCASTS_COLL);
        let broadcast_contacts = self.mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);

        // ---- 1. Load + status guard ----------------------------------
        let broadcast = match broadcasts
            .find_one(doc! { "_id": broadcast_id })
            .await
            .context("broadcasts.find_one")?
        {
            Some(b) => b,
            None => {
                warn!(broadcast_id = %broadcast_id.to_hex(), "broadcast not found");
                return Ok(json!({ "skipped": true, "reason": "not-found" }));
            }
        };
        let status = broadcast.get_str("status").unwrap_or("").to_owned();
        if matches!(
            status.as_str(),
            "Completed" | "Cancelled" | "FAILED_PROCESSING"
        ) {
            return Ok(json!({ "skipped": true, "reason": status }));
        }

        let project_id = broadcast
            .get_object_id("projectId")
            .map_err(|_| anyhow!("broadcast.projectId missing"))?;

        // ---- 2. Take ownership idempotently --------------------------
        let started_at = broadcast
            .get_datetime("startedAt")
            .copied()
            .unwrap_or_else(|_| bson::DateTime::from_chrono(Utc::now()));
        broadcasts
            .update_one(
                doc! { "_id": broadcast_id },
                doc! {
                    "$set": {
                        "status": "PROCESSING",
                        "startedAt": started_at,
                        "controlWorkerId": &self.worker_id,
                        "lastControlPickupAt": bson::DateTime::from_chrono(Utc::now()),
                    }
                },
            )
            .await
            .context("broadcasts.updateOne(PROCESSING)")?;

        let resuming = broadcast.get_object_id("lastEnqueuedContactId").is_ok();
        log_event(
            &self.mongo,
            broadcast_id,
            project_id,
            "INFO",
            &format!(
                "Control worker {} picked up broadcast (resume={})",
                self.worker_id, resuming
            ),
        )
        .await;

        // ---- 3. Header media one-shot upload -------------------------
        let mut working_broadcast = broadcast.clone();
        if working_broadcast.get_str("headerMediaId").is_err()
            && working_broadcast.contains_key("headerMediaFile")
        {
            match upload_header_media_if_needed(
                &broadcasts,
                &working_broadcast,
                &self.cfg.api_version,
                &self.http,
            )
            .await
            {
                Ok(Some(uploaded)) => {
                    working_broadcast.insert("headerMediaId", Bson::String(uploaded.id.clone()));
                    working_broadcast
                        .insert("headerMediaType", Bson::String(uploaded.media_type.clone()));
                    log_event(
                        &self.mongo,
                        broadcast_id,
                        project_id,
                        "INFO",
                        &format!("Header media uploaded: {}", uploaded.id),
                    )
                    .await;
                }
                Ok(None) => {}
                Err(e) => {
                    let msg = e.to_string();
                    let _ = broadcasts
                        .update_one(
                            doc! { "_id": broadcast_id },
                            doc! {
                                "$set": {
                                    "status": "FAILED_PROCESSING",
                                    "error": format!("Media upload failed: {msg}"),
                                }
                            },
                        )
                        .await;
                    log_event(
                        &self.mongo,
                        broadcast_id,
                        project_id,
                        "ERROR",
                        &format!("Media upload failed: {msg}"),
                    )
                    .await;
                    return Ok(json!({ "failed": true, "error": msg }));
                }
            }
        }

        // ---- 4. Cursor over PENDING contacts -------------------------
        let mut filter = doc! {
            "broadcastId": broadcast_id,
            "status": "PENDING",
        };
        if let Ok(last_id) = working_broadcast.get_object_id("lastEnqueuedContactId") {
            filter.insert("_id", doc! { "$gt": last_id });
        }

        let find_opts = FindOptions::builder()
            .sort(doc! { "_id": 1 })
            .projection(doc! { "_id": 1 })
            .batch_size(2_000_u32)
            .build();

        let mut cursor = broadcast_contacts
            .find(filter)
            .with_options(find_opts)
            .await
            .context("broadcast_contacts.find")?;

        let mut buf: Vec<ObjectId> = Vec::with_capacity(self.cfg.batch_size);
        let mut total_enqueued = working_broadcast
            .get_i32("enqueuedCount")
            .map(|n| n as i64)
            .or_else(|_| working_broadcast.get_i64("enqueuedCount"))
            .unwrap_or(0);
        let mut last_id_opt = working_broadcast
            .get_object_id("lastEnqueuedContactId")
            .ok();
        let mut since_checkpoint = 0_usize;
        let mut since_cancel = 0_usize;

        while let Some(doc) = cursor
            .try_next()
            .await
            .context("broadcast_contacts cursor advance")?
        {
            let id = doc
                .get_object_id("_id")
                .map_err(|_| anyhow!("broadcast_contact missing _id"))?;
            buf.push(id);
            last_id_opt = Some(id);

            if buf.len() >= self.cfg.batch_size {
                let batch = std::mem::replace(&mut buf, Vec::with_capacity(self.cfg.batch_size));
                self.enqueue_batch(&broadcast_id, &batch, 0)
                    .await
                    .context("enqueue_batch")?;
                total_enqueued += batch.len() as i64;
                since_checkpoint += 1;
                since_cancel += 1;

                if since_checkpoint >= self.cfg.checkpoint_every {
                    if let Some(last) = last_id_opt {
                        let _ = broadcasts
                            .update_one(
                                doc! { "_id": broadcast_id },
                                doc! {
                                    "$set": {
                                        "lastEnqueuedContactId": last,
                                        "enqueuedCount": total_enqueued,
                                    }
                                },
                            )
                            .await;
                    }
                    since_checkpoint = 0;
                }

                if since_cancel >= self.cfg.cancel_check_every {
                    since_cancel = 0;
                    if let Ok(Some(fresh)) = broadcasts
                        .find_one(doc! { "_id": broadcast_id })
                        .with_options(
                            mongodb::options::FindOneOptions::builder()
                                .projection(doc! { "status": 1 })
                                .build(),
                        )
                        .await
                    {
                        if fresh.get_str("status").unwrap_or("") == "Cancelled" {
                            log_event(
                                &self.mongo,
                                broadcast_id,
                                project_id,
                                "WARN",
                                &format!(
                                    "Cancellation detected after enqueueing {total_enqueued} contacts"
                                ),
                            )
                            .await;
                            return Ok(json!({
                                "cancelled": true,
                                "enqueued": total_enqueued,
                            }));
                        }
                    }
                }
            }
        }

        // Flush trailing partial batch.
        if !buf.is_empty() {
            let n = buf.len() as i64;
            self.enqueue_batch(&broadcast_id, &buf, 0)
                .await
                .context("enqueue_batch (final)")?;
            total_enqueued += n;
        }

        let mut final_set = doc! {
            "enqueuedCount": total_enqueued,
            "allEnqueuedAt": bson::DateTime::from_chrono(Utc::now()),
        };
        if let Some(last) = last_id_opt {
            final_set.insert("lastEnqueuedContactId", last);
        }
        let _ = broadcasts
            .update_one(doc! { "_id": broadcast_id }, doc! { "$set": final_set })
            .await;

        log_event(
            &self.mongo,
            broadcast_id,
            project_id,
            "INFO",
            &format!(
                "All {total_enqueued} contacts enqueued in batches of {}",
                self.cfg.batch_size
            ),
        )
        .await;

        info!(
            broadcast_id = %broadcast_id.to_hex(),
            total_enqueued,
            "control handler complete"
        );
        Ok(json!({ "enqueued": total_enqueued }))
    }

    /// Enqueue one `send-batch` job. Mirrors the Node `enqueueBatch`
    /// helper in `src/workers/broadcast/queue.js`.
    async fn enqueue_batch(
        &self,
        broadcast_id: &ObjectId,
        contact_ids: &[ObjectId],
        delay_ms: u64,
    ) -> Result<()> {
        let payload = json!({
            "broadcastId": broadcast_id.to_hex(),
            "contactIds": contact_ids
                .iter()
                .map(|i| i.to_hex())
                .collect::<Vec<_>>(),
        });
        let opts = JobOptions {
            priority: Some(1_000),
            delay_ms: if delay_ms > 0 { Some(delay_ms) } else { None },
            ..Default::default()
        };
        self.bull
            .add(SEND_QUEUE, SEND_JOB, &payload, opts)
            .await
            .map(|_| ())
            .map_err(|e| anyhow!("enqueue send-batch: {e}"))
    }
}

/// Append a row to `broadcast_logs` — mirrors the Node `logBroadcast`.
/// Best-effort: write failures are logged but never propagated, so a
/// dead `broadcast_logs` index doesn't block real progress.
pub(crate) async fn log_event(
    mongo: &MongoHandle,
    broadcast_id: ObjectId,
    project_id: ObjectId,
    level: &str,
    message: &str,
) {
    let coll = mongo.collection::<Document>(BROADCAST_LOGS_COLL);
    if let Err(e) = coll
        .insert_one(doc! {
            "broadcastId": broadcast_id,
            "projectId": project_id,
            "level": level,
            "message": message,
            "timestamp": bson::DateTime::from_chrono(Utc::now()),
        })
        .await
    {
        debug!(error = ?e, "broadcast_logs.insertOne failed (best-effort)");
    }
}
