//! Trigger listener.
//!
//! Every 60 seconds, polls for new external events that should enrol
//! subscribers into active journeys. Today we only implement
//! `list_join`: scan `email_subscribers` for docs created since the
//! last cursor and bulk-enrol the matches into every active journey
//! whose `trigger.kind == "list_join"` and whose
//! `trigger.config.listId` matches the subscriber's `listId` (or is
//! absent, meaning any list).
//!
//! `tag_added` and `segment_enter` are TODO — they will require event
//! sourcing off `email_events` or list-membership audit rows the
//! existing TS code does not yet emit.

use std::time::Duration;

use anyhow::{Context, Result};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use email_types::collections::{JOURNEYS, SUBSCRIBERS};
use futures::TryStreamExt;
use tracing::{info, warn};

use crate::EmailJourneyWorkerState;
use crate::queue::enqueue_enroll_bulk;

/// Polling interval. 60s matches the spec — we accept up to a minute
/// of lag between list-join and enrolment.
const TICK_INTERVAL: Duration = Duration::from_secs(60);

pub async fn run_trigger_listener(state: EmailJourneyWorkerState) -> Result<()> {
    info!("journey trigger listener started");
    let mut ticker = tokio::time::interval(TICK_INTERVAL);
    ticker.tick().await;

    // Cursor: process subscribers added after this timestamp. We init
    // at "now" so the first sweep does not retroactively enrol every
    // historical subscriber.
    let mut cursor: DateTime<Utc> = Utc::now();

    loop {
        ticker.tick().await;
        match sweep_once(&state, cursor).await {
            Ok(next_cursor) => cursor = next_cursor,
            Err(e) => warn!(error = ?e, "trigger sweep failed"),
        }
    }
}

async fn sweep_once(
    state: &EmailJourneyWorkerState,
    since: DateTime<Utc>,
) -> Result<DateTime<Utc>> {
    let now = Utc::now();

    // Load active journeys with trigger.kind == list_join. We bucket
    // by tenant so per-tenant subscriber scans don't fan across the
    // whole subscriber table.
    let journeys_coll = state.mongo.collection::<Document>(JOURNEYS);
    let cursor = journeys_coll
        .find(doc! {
            "status": "active",
            "trigger.kind": "list_join",
        })
        .await
        .context("journeys.find.list_join")?;
    let journeys: Vec<Document> = cursor.try_collect().await.context("journeys.collect")?;

    if journeys.is_empty() {
        // Still note unimplemented triggers so operators see the gap.
        warn!("tag_added / segment_enter triggers not yet implemented in journey worker");
        return Ok(now);
    }

    let subs_coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    let since_bd: bson::DateTime = since.into();
    let now_bd: bson::DateTime = now.into();

    for journey in journeys {
        let Ok(journey_oid) = journey.get_object_id("_id") else {
            continue;
        };
        let Ok(tenant_oid) = journey.get_object_id("userId") else {
            continue;
        };

        // Optional list scoping: trigger.config.listId. If absent, the
        // journey accepts any subscriber added under this tenant.
        let trigger_doc = journey.get_document("trigger").ok();
        let list_oid = trigger_doc
            .and_then(|t| t.get_document("config").ok())
            .and_then(|c| c.get_str("listId").ok())
            .and_then(|s| ObjectId::parse_str(s).ok());

        let mut filter = doc! {
            "userId": tenant_oid,
            "createdAt": { "$gt": since_bd.clone(), "$lte": now_bd.clone() },
            "status": "subscribed",
        };
        if let Some(lid) = list_oid {
            filter.insert("listId", lid);
        }

        let cursor = match subs_coll.find(filter).await {
            Ok(c) => c,
            Err(e) => {
                warn!(error = ?e, "subscribers.find in trigger listener");
                continue;
            }
        };
        let docs: Vec<Document> = match cursor.try_collect().await {
            Ok(v) => v,
            Err(e) => {
                warn!(error = ?e, "subscribers.collect in trigger listener");
                continue;
            }
        };
        if docs.is_empty() {
            continue;
        }

        let sub_ids: Vec<String> = docs
            .iter()
            .filter_map(|d| d.get_object_id("_id").ok().map(|o| o.to_hex()))
            .collect();
        if sub_ids.is_empty() {
            continue;
        }

        info!(
            journey_id = %journey_oid.to_hex(),
            count = sub_ids.len(),
            "list_join trigger matched — bulk enrolling"
        );
        if let Err(e) = enqueue_enroll_bulk(&state.bull, &journey_oid.to_hex(), &sub_ids).await
        {
            warn!(error = ?e, "failed to enqueue enroll-bulk");
        }
    }

    Ok(now)
}
