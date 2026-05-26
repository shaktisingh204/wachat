//! BullMQ consumer for the `"email-journey"` queue + per-node processor.
//!
//! Job kinds:
//!
//!   * `journey-tick`        — `{ journeyId, runId, nodeId }`. Loads the
//!     node by id off the journey doc, dispatches by node `type`, and
//!     hands off to the next node (or schedules a wait, or exits).
//!   * `journey-enroll-bulk` — `{ journeyId, subscriberIds[] }`. Creates
//!     one `email_journey_runs` per subscriber + enqueues a `journey-tick`
//!     for the entry node.

use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use email_types::{
    collections::{JOURNEY_RUNS, JOURNEYS, SUBSCRIBERS},
    journey::{EmailJourneyWait, WaitUnit},
    segment::EmailFilterTree,
};
use rand::Rng;
use serde_json::{Value, json};
use tracing::{info, warn};
use wachat_queue::{
    BullJob, BullProducer, JobHandler, JobOptions, JobOutcome, Worker, WorkerOptions,
};

use crate::EmailJourneyWorkerState;
use crate::filter::filter_to_mongo;

/// BullMQ queue name this worker drains.
pub const JOURNEY_QUEUE: &str = "email-journey";
/// Sibling queue: the email sender drains this. We push `journey-step`
/// jobs onto it from inside `email` node processing.
pub const SEND_QUEUE: &str = "email-send";

const JOB_TICK: &str = "journey-tick";
const JOB_ENROLL_BULK: &str = "journey-enroll-bulk";
const JOB_JOURNEY_STEP: &str = "journey-step";

/// Run the BullMQ consumer to completion.
pub async fn run_consumer(state: EmailJourneyWorkerState) -> Result<()> {
    let handler = Arc::new(JourneyHandler {
        state: state.clone(),
    });
    let worker = Worker::new(
        state.redis.clone(),
        JOURNEY_QUEUE,
        handler,
        WorkerOptions::default(),
    );
    info!(queue = JOURNEY_QUEUE, "journey worker starting");
    worker
        .run()
        .await
        .map_err(|e| anyhow!("journey worker exited: {e}"))?;
    info!(queue = JOURNEY_QUEUE, "journey worker stopped");
    Ok(())
}

struct JourneyHandler {
    state: EmailJourneyWorkerState,
}

#[async_trait]
impl JobHandler for JourneyHandler {
    async fn process(&self, job: &BullJob) -> Result<JobOutcome> {
        let result = match job.name.as_str() {
            JOB_TICK => handle_tick(&self.state, &job.data).await,
            JOB_ENROLL_BULK => handle_enroll_bulk(&self.state, &job.data).await,
            other => Err(anyhow!("unknown journey job `{other}`")),
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
// kind = "journey-tick"
// ===========================================================================

/// Process a single node for a single run.
async fn handle_tick(state: &EmailJourneyWorkerState, data: &Value) -> Result<Value> {
    let journey_id = data
        .get("journeyId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("journey-tick missing journeyId"))?;
    let run_id = data
        .get("runId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("journey-tick missing runId"))?;
    let node_id = data
        .get("nodeId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("journey-tick missing nodeId"))?;

    let journey = load_journey(state, journey_id).await?;
    let run = load_run(state, run_id).await?;

    // Refuse to tick non-active runs — the run may have been cancelled
    // out of band (e.g. subscriber unsubscribed by another action).
    let run_status = run.get_str("status").unwrap_or("");
    if matches!(run_status, "completed" | "exited" | "errored") {
        info!(
            run_id,
            status = run_status,
            "skipping tick — run terminated"
        );
        return Ok(json!({ "kind": "journey-tick", "skipped": run_status }));
    }

    let node = find_node(&journey, node_id)
        .ok_or_else(|| anyhow!("node `{node_id}` not found in journey {journey_id}"))?;
    let node_type = node.get_str("type").unwrap_or("").to_owned();
    let node_data = node.get_document("data").cloned().unwrap_or_default();

    let tenant_oid = journey
        .get_object_id("userId")
        .map_err(|_| anyhow!("journey missing userId"))?;
    let journey_oid = journey
        .get_object_id("_id")
        .map_err(|_| anyhow!("journey missing _id"))?;
    let run_oid = run
        .get_object_id("_id")
        .map_err(|_| anyhow!("run missing _id"))?;
    let subscriber_oid = run
        .get_object_id("subscriberId")
        .map_err(|_| anyhow!("run missing subscriberId"))?;

    let mut history_entry = doc! {
        "nodeId": node_id,
        "kind": node_type.clone(),
        "at": bson::DateTime::from(Utc::now()),
    };

    let next_node_id: Option<String> = match node_type.as_str() {
        "trigger" => {
            // Trigger node is the entry point only — immediately advance.
            first_outgoing(&journey, node_id, None)
        }
        "email" => {
            // Hand off to email-send queue, then advance.
            let payload = json!({
                "kind": JOB_JOURNEY_STEP,
                "journeyId": journey_oid.to_hex(),
                "runId": run_oid.to_hex(),
                "nodeId": node_id,
                "tenantId": tenant_oid.to_hex(),
                "subscriberId": subscriber_oid.to_hex(),
                "emailTemplateId": node_data.get_str("emailTemplateId").ok().map(str::to_owned),
                "emailSubject": node_data.get_str("emailSubject").ok().map(str::to_owned),
            });
            let opts = JobOptions {
                attempts: 5,
                job_id: Some(format!("journey_step_{}_{}", run_oid.to_hex(), node_id)),
                ..Default::default()
            };
            state
                .bull
                .add(SEND_QUEUE, JOB_JOURNEY_STEP, &payload, opts)
                .await
                .context("bull.add(journey-step)")?;
            first_outgoing(&journey, node_id, None)
        }
        "wait" => {
            // Persist `nextStepAt`; the scheduler picks it back up.
            let wait = parse_wait(&node_data).unwrap_or(EmailJourneyWait {
                value: 1,
                unit: WaitUnit::Hours,
            });
            let secs = wait_to_seconds(&wait);
            let next_at = Utc::now() + chrono::Duration::seconds(secs);
            let next_node = first_outgoing(&journey, node_id, None);
            let next_node_for_persist = next_node.clone().unwrap_or_default();
            state
                .mongo
                .collection::<Document>(JOURNEY_RUNS)
                .update_one(
                    doc! { "_id": run_oid },
                    doc! { "$set": {
                        "status": "waiting",
                        "nextStepAt": bson::DateTime::from(next_at),
                        "pendingNodeId": next_node_for_persist.clone(),
                    } },
                )
                .await
                .context("runs.update.wait")?;
            history_entry.insert("waitSeconds", secs);
            append_history(state, run_oid, &history_entry).await?;
            // Do NOT advance now — scheduler will tick the next node
            // when `nextStepAt` is past.
            return Ok(json!({
                "kind": "journey-tick",
                "node": node_type,
                "waitedUntil": next_at.to_rfc3339(),
                "nextNode": next_node_for_persist,
            }));
        }
        "condition" => {
            // Evaluate filter against the subscriber doc.
            let decision = eval_condition(state, &node_data, tenant_oid, subscriber_oid).await?;
            history_entry.insert("decision", if decision { "true" } else { "false" });
            let handle = if decision { "true" } else { "false" };
            first_outgoing(&journey, node_id, Some(handle))
                .or_else(|| first_outgoing(&journey, node_id, None))
        }
        "action" => {
            execute_action(state, &node_data, tenant_oid, subscriber_oid).await?;
            first_outgoing(&journey, node_id, None)
        }
        "split" => {
            let weights = split_weights(&node_data);
            let outgoing = outgoing_targets(&journey, node_id);
            if outgoing.is_empty() {
                None
            } else {
                let pick = weighted_pick(&weights, outgoing.len());
                history_entry.insert("split", pick as i64);
                Some(outgoing[pick].clone())
            }
        }
        "exit" => {
            // Terminate the run.
            state
                .mongo
                .collection::<Document>(JOURNEY_RUNS)
                .update_one(
                    doc! { "_id": run_oid },
                    doc! { "$set": {
                        "status": "completed",
                        "completedAt": bson::DateTime::from(Utc::now()),
                    } },
                )
                .await
                .context("runs.update.exit")?;
            append_history(state, run_oid, &history_entry).await?;
            // Bump journey stats.
            let _ = state
                .mongo
                .collection::<Document>(JOURNEYS)
                .update_one(
                    doc! { "_id": journey_oid },
                    doc! { "$inc": { "stats.completed": 1i64, "stats.active": -1i64 } },
                )
                .await;
            return Ok(json!({ "kind": "journey-tick", "node": "exit", "status": "completed" }));
        }
        other => {
            warn!(node_type = other, "unknown node type, advancing");
            first_outgoing(&journey, node_id, None)
        }
    };

    append_history(state, run_oid, &history_entry).await?;

    match next_node_id {
        Some(next) => {
            // Advance currentNodeId + enqueue tick.
            state
                .mongo
                .collection::<Document>(JOURNEY_RUNS)
                .update_one(
                    doc! { "_id": run_oid },
                    doc! { "$set": {
                        "currentNodeId": next.clone(),
                        "status": "active",
                    } },
                )
                .await
                .context("runs.update.advance")?;

            let payload = json!({
                "kind": "journey-tick",
                "journeyId": journey_oid.to_hex(),
                "runId": run_oid.to_hex(),
                "nodeId": next,
            });
            let opts = JobOptions {
                attempts: 5,
                job_id: Some(format!("journey_tick_{}_{}", run_oid.to_hex(), next)),
                ..Default::default()
            };
            state
                .bull
                .add(JOURNEY_QUEUE, JOB_TICK, &payload, opts)
                .await
                .context("bull.add(journey-tick.next)")?;
            Ok(json!({ "kind": "journey-tick", "node": node_type, "advancedTo": next }))
        }
        None => {
            // No outgoing edge → terminate run as exited (not completed,
            // because we didn't hit an exit node).
            state
                .mongo
                .collection::<Document>(JOURNEY_RUNS)
                .update_one(
                    doc! { "_id": run_oid },
                    doc! { "$set": {
                        "status": "exited",
                        "completedAt": bson::DateTime::from(Utc::now()),
                    } },
                )
                .await
                .context("runs.update.dead-end")?;
            Ok(json!({ "kind": "journey-tick", "node": node_type, "status": "exited" }))
        }
    }
}

// ===========================================================================
// kind = "journey-enroll-bulk"
// ===========================================================================

async fn handle_enroll_bulk(state: &EmailJourneyWorkerState, data: &Value) -> Result<Value> {
    let journey_id = data
        .get("journeyId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("enroll-bulk missing journeyId"))?;
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
        return Ok(json!({ "kind": "journey-enroll-bulk", "enrolled": 0 }));
    }

    let journey = load_journey(state, journey_id).await?;
    let journey_oid = journey
        .get_object_id("_id")
        .map_err(|_| anyhow!("journey missing _id"))?;
    let tenant_oid = journey
        .get_object_id("userId")
        .map_err(|_| anyhow!("journey missing userId"))?;
    let entry_node_id =
        entry_node_id_of(&journey).ok_or_else(|| anyhow!("journey has no entry node"))?;

    let now: bson::DateTime = Utc::now().into();
    let mut runs: Vec<Document> = Vec::with_capacity(subscriber_ids.len());
    let mut enqueue: Vec<(ObjectId, String)> = Vec::with_capacity(subscriber_ids.len());

    for sid in &subscriber_ids {
        let Ok(sub_oid) = ObjectId::parse_str(sid) else {
            continue;
        };
        let run_oid = ObjectId::new();
        runs.push(doc! {
            "_id": run_oid,
            "userId": tenant_oid,
            "journeyId": journey_oid,
            "subscriberId": sub_oid,
            "currentNodeId": entry_node_id.clone(),
            "status": "active",
            "enteredAt": now,
            "history": Bson::Array(Vec::new()),
        });
        enqueue.push((run_oid, entry_node_id.clone()));
    }

    let enrolled = runs.len();
    if enrolled == 0 {
        return Ok(json!({ "kind": "journey-enroll-bulk", "enrolled": 0 }));
    }

    state
        .mongo
        .collection::<Document>(JOURNEY_RUNS)
        .insert_many(runs)
        .await
        .context("runs.insert_many")?;

    let _ = state
        .mongo
        .collection::<Document>(JOURNEYS)
        .update_one(
            doc! { "_id": journey_oid },
            doc! { "$inc": {
                "stats.entered": enrolled as i64,
                "stats.active": enrolled as i64,
            } },
        )
        .await;

    for (run_oid, node_id) in enqueue {
        let payload = json!({
            "kind": "journey-tick",
            "journeyId": journey_oid.to_hex(),
            "runId": run_oid.to_hex(),
            "nodeId": node_id,
        });
        let opts = JobOptions {
            attempts: 5,
            job_id: Some(format!("journey_tick_{}", run_oid.to_hex())),
            ..Default::default()
        };
        if let Err(e) = state
            .bull
            .add(JOURNEY_QUEUE, JOB_TICK, &payload, opts)
            .await
        {
            warn!(error = ?e, run_id = %run_oid.to_hex(), "failed to enqueue initial tick");
        }
    }

    Ok(json!({ "kind": "journey-enroll-bulk", "enrolled": enrolled }))
}

// ===========================================================================
// Helpers — Mongo loads, node lookup, edge selection
// ===========================================================================

async fn load_journey(state: &EmailJourneyWorkerState, journey_id: &str) -> Result<Document> {
    let oid = ObjectId::parse_str(journey_id).map_err(|e| anyhow!("invalid journeyId: {e}"))?;
    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .find_one(doc! { "_id": oid })
        .await
        .context("journeys.find_one")?
        .ok_or_else(|| anyhow!("journey {journey_id} not found"))
}

async fn load_run(state: &EmailJourneyWorkerState, run_id: &str) -> Result<Document> {
    let oid = ObjectId::parse_str(run_id).map_err(|e| anyhow!("invalid runId: {e}"))?;
    state
        .mongo
        .collection::<Document>(JOURNEY_RUNS)
        .find_one(doc! { "_id": oid })
        .await
        .context("runs.find_one")?
        .ok_or_else(|| anyhow!("run {run_id} not found"))
}

fn find_node<'a>(journey: &'a Document, node_id: &str) -> Option<&'a Document> {
    let arr = journey.get_array("nodes").ok()?;
    for n in arr {
        if let Some(d) = n.as_document() {
            if d.get_str("id").ok() == Some(node_id) {
                return Some(d);
            }
        }
    }
    None
}

/// Return the first outgoing edge's `target` for `node_id`. If
/// `handle` is given, prefer the edge whose `sourceHandle` matches.
fn first_outgoing(journey: &Document, node_id: &str, handle: Option<&str>) -> Option<String> {
    let arr = journey.get_array("edges").ok()?;
    let mut fallback: Option<String> = None;
    for e in arr {
        let Some(d) = e.as_document() else { continue };
        if d.get_str("source").ok() != Some(node_id) {
            continue;
        }
        let target = d.get_str("target").ok()?.to_owned();
        if let Some(h) = handle {
            if d.get_str("sourceHandle").ok() == Some(h) {
                return Some(target);
            }
        }
        if fallback.is_none() {
            fallback = Some(target);
        }
    }
    fallback
}

fn outgoing_targets(journey: &Document, node_id: &str) -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(arr) = journey.get_array("edges") {
        for e in arr {
            if let Some(d) = e.as_document() {
                if d.get_str("source").ok() == Some(node_id) {
                    if let Ok(t) = d.get_str("target") {
                        out.push(t.to_owned());
                    }
                }
            }
        }
    }
    out
}

fn entry_node_id_of(journey: &Document) -> Option<String> {
    let arr = journey.get_array("nodes").ok()?;
    let mut first: Option<String> = None;
    for n in arr {
        let Some(d) = n.as_document() else { continue };
        let Some(id) = d.get_str("id").ok() else {
            continue;
        };
        if d.get_str("type").ok() == Some("trigger") {
            return Some(id.to_owned());
        }
        if first.is_none() {
            first = Some(id.to_owned());
        }
    }
    first
}

// ===========================================================================
// Node helpers — wait, condition, action, split
// ===========================================================================

fn parse_wait(node_data: &Document) -> Option<EmailJourneyWait> {
    let wf = node_data.get_document("waitFor").ok()?;
    let value = wf
        .get_i64("value")
        .or_else(|_| wf.get_i32("value").map(i64::from))
        .ok()? as u64;
    let unit_raw = wf.get_str("unit").ok()?;
    let unit = match unit_raw {
        "minutes" => WaitUnit::Minutes,
        "hours" => WaitUnit::Hours,
        "days" => WaitUnit::Days,
        _ => return None,
    };
    Some(EmailJourneyWait { value, unit })
}

fn wait_to_seconds(w: &EmailJourneyWait) -> i64 {
    let v = w.value as i64;
    match w.unit {
        WaitUnit::Minutes => v * 60,
        WaitUnit::Hours => v * 3_600,
        WaitUnit::Days => v * 86_400,
    }
}

/// Evaluate a condition node against the subscriber document. The
/// condition is stored under `node_data.condition` as an
/// `EmailFilterTree`. We translate to Mongo and `findOne` with
/// `_id = subscriber + userId = tenant + filter`.
async fn eval_condition(
    state: &EmailJourneyWorkerState,
    node_data: &Document,
    tenant_oid: ObjectId,
    subscriber_oid: ObjectId,
) -> Result<bool> {
    let Some(cond_bson) = node_data.get("condition") else {
        // No filter → treat as truthy.
        return Ok(true);
    };
    let tree: EmailFilterTree =
        bson::from_bson(cond_bson.clone()).context("condition.decode (EmailFilterTree)")?;
    let mut filter = filter_to_mongo(&tree);
    filter.insert("_id", subscriber_oid);
    filter.insert("userId", tenant_oid);

    let hit = state
        .mongo
        .collection::<Document>(SUBSCRIBERS)
        .find_one(filter)
        .await
        .context("subscribers.find_one (condition)")?;
    Ok(hit.is_some())
}

/// Execute an `action` node — direct Mongo writes against the
/// subscriber doc. Supports the kinds enumerated in
/// [`email_types::EmailJourneyActionKind`]: tag_add, tag_remove,
/// list_move, webhook (logged TODO), update_field, unsubscribe.
async fn execute_action(
    state: &EmailJourneyWorkerState,
    node_data: &Document,
    tenant_oid: ObjectId,
    subscriber_oid: ObjectId,
) -> Result<()> {
    let Some(action_doc) = node_data.get_document("action").ok() else {
        // No-op action — accept and advance.
        return Ok(());
    };
    let kind = action_doc.get_str("kind").unwrap_or("").to_owned();
    let config = action_doc
        .get_document("config")
        .cloned()
        .unwrap_or_default();

    let subs = state.mongo.collection::<Document>(SUBSCRIBERS);
    let filter = doc! { "_id": subscriber_oid, "userId": tenant_oid };

    match kind.as_str() {
        "tag_add" => {
            let tag = config.get_str("tag").unwrap_or("").to_owned();
            if !tag.is_empty() {
                subs.update_one(filter, doc! { "$addToSet": { "tags": tag } })
                    .await
                    .context("action.tag_add")?;
            }
        }
        "tag_remove" => {
            let tag = config.get_str("tag").unwrap_or("").to_owned();
            if !tag.is_empty() {
                subs.update_one(filter, doc! { "$pull": { "tags": tag } })
                    .await
                    .context("action.tag_remove")?;
            }
        }
        "list_move" => {
            if let Ok(list_id) = config.get_str("listId") {
                if let Ok(list_oid) = ObjectId::parse_str(list_id) {
                    subs.update_one(filter, doc! { "$set": { "listId": list_oid } })
                        .await
                        .context("action.list_move")?;
                }
            }
        }
        "update_field" => {
            // config: { field: "x", value: ... }
            if let Ok(field) = config.get_str("field") {
                if let Some(v) = config.get("value") {
                    let mut set_doc = Document::new();
                    set_doc.insert(field.to_owned(), v.clone());
                    subs.update_one(filter, doc! { "$set": set_doc })
                        .await
                        .context("action.update_field")?;
                }
            }
        }
        "unsubscribe" => {
            subs.update_one(
                filter,
                doc! { "$set": {
                    "status": "unsubscribed",
                    "unsubscribedAt": bson::DateTime::from(Utc::now()),
                } },
            )
            .await
            .context("action.unsubscribe")?;
        }
        "webhook" => {
            // Not implemented in the worker today — leave a breadcrumb.
            warn!(kind = %kind, "webhook action not yet implemented in journey worker");
        }
        other => {
            warn!(kind = %other, "unknown action kind, skipping");
        }
    }
    Ok(())
}

/// Split-weight handling: if `splitWeights = [w0, w1, ...]` is present,
/// use weighted choice; otherwise default to uniform.
fn split_weights(node_data: &Document) -> Vec<u8> {
    if let Ok(arr) = node_data.get_array("splitWeights") {
        arr.iter()
            .filter_map(|b| {
                b.as_i32()
                    .map(i64::from)
                    .or_else(|| b.as_i64())
                    .map(|n| n.clamp(0, 255) as u8)
            })
            .collect()
    } else {
        Vec::new()
    }
}

fn weighted_pick(weights: &[u8], n_outgoing: usize) -> usize {
    if n_outgoing == 0 {
        return 0;
    }
    if weights.is_empty() || weights.len() != n_outgoing {
        // Uniform.
        let mut rng = rand::thread_rng();
        return rng.gen_range(0..n_outgoing);
    }
    let total: u32 = weights.iter().map(|w| *w as u32).sum();
    if total == 0 {
        let mut rng = rand::thread_rng();
        return rng.gen_range(0..n_outgoing);
    }
    let mut rng = rand::thread_rng();
    let mut r = rng.gen_range(0..total);
    for (i, w) in weights.iter().enumerate() {
        let w = *w as u32;
        if r < w {
            return i;
        }
        r -= w;
    }
    n_outgoing - 1
}

/// Append an entry to `email_journey_runs.history`. Best-effort.
async fn append_history(
    state: &EmailJourneyWorkerState,
    run_oid: ObjectId,
    entry: &Document,
) -> Result<()> {
    state
        .mongo
        .collection::<Document>(JOURNEY_RUNS)
        .update_one(
            doc! { "_id": run_oid },
            doc! { "$push": { "history": entry.clone() } },
        )
        .await
        .context("runs.push.history")?;
    Ok(())
}

/// Producer-side helper used by the scheduler / trigger listener to
/// enqueue a tick. Kept here to centralise the queue + job names.
pub async fn enqueue_tick(
    bull: &BullProducer,
    journey_id_hex: &str,
    run_id_hex: &str,
    node_id: &str,
) -> Result<()> {
    let payload = json!({
        "kind": "journey-tick",
        "journeyId": journey_id_hex,
        "runId": run_id_hex,
        "nodeId": node_id,
    });
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!("journey_tick_{run_id_hex}_{node_id}")),
        ..Default::default()
    };
    bull.add(JOURNEY_QUEUE, JOB_TICK, &payload, opts)
        .await
        .map_err(|e| anyhow!("enqueue tick: {e}"))?;
    Ok(())
}

/// Producer-side helper used by the trigger listener to enqueue a
/// bulk enrol job.
pub async fn enqueue_enroll_bulk(
    bull: &BullProducer,
    journey_id_hex: &str,
    subscriber_ids: &[String],
) -> Result<()> {
    let payload = json!({
        "kind": "journey-enroll-bulk",
        "journeyId": journey_id_hex,
        "subscriberIds": subscriber_ids,
    });
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!(
            "journey_enroll_{}_{}",
            journey_id_hex,
            Utc::now().timestamp_millis()
        )),
        ..Default::default()
    };
    bull.add(JOURNEY_QUEUE, JOB_ENROLL_BULK, &payload, opts)
        .await
        .map_err(|e| anyhow!("enqueue enroll-bulk: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    #[test]
    fn test_first_outgoing_fallback() {
        let journey = doc! {
            "edges": [
                { "source": "node1", "target": "node2" },
                { "source": "node1", "target": "node3", "sourceHandle": "true" }
            ]
        };
        // Matches handle
        assert_eq!(
            first_outgoing(&journey, "node1", Some("true")).unwrap(),
            "node3"
        );
        // Fallback to first if handle not found
        assert_eq!(
            first_outgoing(&journey, "node1", Some("false")).unwrap(),
            "node2"
        );
        assert_eq!(first_outgoing(&journey, "node1", None).unwrap(), "node2");
        // No match
        assert_eq!(first_outgoing(&journey, "nodeX", None), None);
    }

    #[test]
    fn test_entry_node_id_of() {
        let journey = doc! {
            "nodes": [
                { "id": "n1", "type": "email" },
                { "id": "n2", "type": "trigger" }
            ]
        };
        // Should pick trigger
        assert_eq!(entry_node_id_of(&journey).unwrap(), "n2");

        let journey2 = doc! {
            "nodes": [
                { "id": "n3", "type": "email" }
            ]
        };
        // Fallback to first
        assert_eq!(entry_node_id_of(&journey2).unwrap(), "n3");
    }

    #[test]
    fn test_parse_wait_fault_tolerant() {
        // Missing waitFor
        assert_eq!(parse_wait(&doc! {}), None);
        // Valid
        let d = doc! { "waitFor": { "value": 5, "unit": "days" } };
        let w = parse_wait(&d).unwrap();
        assert_eq!(w.value, 5);
        assert!(matches!(w.unit, WaitUnit::Days));
        // String value instead of int - should fail gracefully
        let d2 = doc! { "waitFor": { "value": "5", "unit": "days" } };
        assert_eq!(parse_wait(&d2), None);
    }

    #[test]
    fn test_outgoing_targets() {
        let journey = doc! {
            "edges": [
                { "source": "node1", "target": "node2" },
                { "source": "node1", "target": "node3" },
                { "source": "node2", "target": "node4" }
            ]
        };
        let targets = outgoing_targets(&journey, "node1");
        assert_eq!(targets, vec!["node2".to_string(), "node3".to_string()]);
    }
}
