//! Wait-node scheduler.
//!
//! Every 30 seconds, finds `email_journey_runs` with `status=waiting`
//! and `nextStepAt <= now` and enqueues a `journey-tick` for the run's
//! `pendingNodeId`. Resets `nextStepAt` and `pendingNodeId` and flips
//! status back to `active` so the consumer can take it from there.

use std::time::Duration;

use anyhow::{Context, Result};
use bson::{Document, doc};
use chrono::Utc;
use email_types::collections::JOURNEY_RUNS;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use tracing::{info, warn};

use crate::EmailJourneyWorkerState;
use crate::queue::enqueue_tick;

/// Polling interval. 30s mirrors the spec.
const TICK_INTERVAL: Duration = Duration::from_secs(30);
/// Maximum number of waiting runs to wake per pass — prevents one
/// scheduler tick from monopolising Redis when a tenant has thousands
/// of waiting runs.
const MAX_PER_PASS: i64 = 500;

pub async fn run_scheduler(state: EmailJourneyWorkerState) -> Result<()> {
    info!("journey scheduler started");
    let mut ticker = tokio::time::interval(TICK_INTERVAL);
    // Skip the immediate first tick; let the worker fully wire up.
    ticker.tick().await;
    loop {
        ticker.tick().await;
        if let Err(e) = sweep_once(&state).await {
            warn!(error = ?e, "scheduler sweep failed");
        }
    }
}

async fn sweep_once(state: &EmailJourneyWorkerState) -> Result<()> {
    let now: bson::DateTime = Utc::now().into();
    let coll = state.mongo.collection::<Document>(JOURNEY_RUNS);

    let opts = FindOptions::builder().limit(MAX_PER_PASS).build();
    let cursor = coll
        .find(doc! {
            "status": "waiting",
            "nextStepAt": { "$lte": now },
        })
        .with_options(opts)
        .await
        .context("scheduler.find")?;
    let docs: Vec<Document> = cursor.try_collect().await.context("scheduler.collect")?;

    if docs.is_empty() {
        return Ok(());
    }
    info!(count = docs.len(), "waking waiting journey runs");

    for d in docs {
        let Ok(run_oid) = d.get_object_id("_id") else {
            continue;
        };
        let Ok(journey_oid) = d.get_object_id("journeyId") else {
            continue;
        };
        let pending_node = d
            .get_str("pendingNodeId")
            .ok()
            .map(str::to_owned)
            .unwrap_or_else(|| {
                d.get_str("currentNodeId").unwrap_or("").to_owned()
            });
        if pending_node.is_empty() {
            warn!(
                run_id = %run_oid.to_hex(),
                "waiting run has no pendingNodeId / currentNodeId; skipping"
            );
            continue;
        }

        // Flip to active first so a duplicate sweep doesn't double-fire.
        let res = coll
            .update_one(
                doc! { "_id": run_oid, "status": "waiting" },
                doc! { "$set": {
                    "status": "active",
                    "currentNodeId": pending_node.clone(),
                }, "$unset": { "nextStepAt": "", "pendingNodeId": "" } },
            )
            .await
            .context("scheduler.flip_active")?;
        if res.modified_count == 0 {
            // Lost the race — another sweep picked it up.
            continue;
        }

        if let Err(e) = enqueue_tick(
            &state.bull,
            &journey_oid.to_hex(),
            &run_oid.to_hex(),
            &pending_node,
        )
        .await
        {
            warn!(error = ?e, run_id = %run_oid.to_hex(), "failed to enqueue wake tick");
        }
    }
    Ok(())
}
