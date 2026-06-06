//! HTTP handlers for the wachat flow-events domain.
//!
//! Aggregates the `wa_flow_events` collection (docs shaped
//! `{ flowId, projectId, userId, ts }`) into trigger metrics for the
//! flow-builder pages. Every query is scoped to the authenticated user's
//! `userId`, so one tenant can never read another tenant's events.
//!
//! | Endpoint                                      | Action               |
//! |-----------------------------------------------|----------------------|
//! | `GET /v1/wachat/flow-events/{flowId}/metrics` | metrics for one flow |
//! | `GET /v1/wachat/flow-events?projectId=…`      | metrics for a project|
//!
//! Reads never fabricate values: a flow with no events yields
//! `{ triggersToday: 0, totalTriggers: 0, lastTriggeredAt: null }`.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Timelike, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::dto::{BatchMetricsResponse, BatchQuery, FlowMetrics};
use crate::state::WachatFlowEventsState;

const COLL: &str = "wa_flow_events";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Start-of-day (UTC) as a BSON datetime, used as the `triggersToday` lower bound.
fn start_of_utc_day() -> bson::DateTime {
    let now = Utc::now();
    let midnight = now
        .with_hour(0)
        .and_then(|d| d.with_minute(0))
        .and_then(|d| d.with_second(0))
        .and_then(|d| d.with_nanosecond(0))
        .unwrap_or(now);
    bson::DateTime::from_chrono(midnight)
}

/// Convert a BSON `ts` value to an ISO-8601 string for the client.
///
/// Accepts the canonical `BSON::DateTime` and, defensively, an i64 epoch-ms
/// (some writers may store `ts` as a number).
fn ts_to_iso(value: &Bson) -> Option<String> {
    match value {
        Bson::DateTime(dt) => Some(dt.to_chrono().to_rfc3339()),
        Bson::Int64(ms) => Utc.timestamp_millis_opt(*ms).single().map(|d| d.to_rfc3339()),
        Bson::Int32(ms) => Utc
            .timestamp_millis_opt(i64::from(*ms))
            .single()
            .map(|d| d.to_rfc3339()),
        _ => None,
    }
}

/// Read a `$sum`/count field (group output) as a `u64`, tolerating i32/i64.
fn count_field(doc: &Document, key: &str) -> u64 {
    match doc.get(key) {
        Some(Bson::Int64(n)) => u64::try_from(*n).unwrap_or(0),
        Some(Bson::Int32(n)) => u64::try_from(*n).unwrap_or(0),
        Some(Bson::Double(n)) if *n >= 0.0 => *n as u64,
        _ => 0,
    }
}

// ===========================================================================
// GET /v1/wachat/flow-events/{flowId}/metrics
// ===========================================================================

/// Aggregate trigger metrics for a single flow owned by the caller.
#[instrument(skip_all)]
pub async fn flow_metrics(
    user: AuthUser,
    State(state): State<WachatFlowEventsState>,
    Path(flow_id): Path<String>,
) -> Result<Json<FlowMetrics>> {
    let uid = user_oid(&user)?;
    let flow_oid = ObjectId::parse_str(flow_id.trim())
        .map_err(|_| ApiError::BadRequest("Invalid flow id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(COLL);
    let start_today = start_of_utc_day();

    // One aggregation: total count, today count, and max ts — all tenant-scoped.
    let pipeline = vec![
        doc! { "$match": { "flowId": flow_oid, "userId": uid } },
        doc! { "$group": {
            "_id": Bson::Null,
            "totalTriggers": { "$sum": 1 },
            "triggersToday": {
                "$sum": { "$cond": [ { "$gte": [ "$ts", start_today ] }, 1, 0 ] }
            },
            "lastTriggeredAt": { "$max": "$ts" },
        } },
    ];

    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("flow_events.aggregate")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("flow_events.collect")))?;

    let metrics = match docs.first() {
        Some(d) => FlowMetrics {
            triggers_today: count_field(d, "triggersToday"),
            total_triggers: count_field(d, "totalTriggers"),
            last_triggered_at: d.get("lastTriggeredAt").and_then(ts_to_iso),
        },
        None => FlowMetrics::empty(),
    };

    Ok(Json(metrics))
}

// ===========================================================================
// GET /v1/wachat/flow-events?projectId=…
// ===========================================================================

/// Batch trigger metrics for every flow in a project, keyed by `flowId` hex.
#[instrument(skip_all)]
pub async fn batch_metrics(
    user: AuthUser,
    State(state): State<WachatFlowEventsState>,
    Query(q): Query<BatchQuery>,
) -> Result<Json<BatchMetricsResponse>> {
    let uid = user_oid(&user)?;
    let project_oid = ObjectId::parse_str(q.project_id.trim())
        .map_err(|_| ApiError::BadRequest("Invalid project id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(COLL);
    let start_today = start_of_utc_day();

    // Group by flowId; tenant-scoped to (projectId, userId).
    let pipeline = vec![
        doc! { "$match": { "projectId": project_oid, "userId": uid } },
        doc! { "$group": {
            "_id": "$flowId",
            "totalTriggers": { "$sum": 1 },
            "triggersToday": {
                "$sum": { "$cond": [ { "$gte": [ "$ts", start_today ] }, 1, 0 ] }
            },
            "lastTriggeredAt": { "$max": "$ts" },
        } },
    ];

    let cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("flow_events.batch_aggregate"))
    })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("flow_events.batch_collect"))
    })?;

    let mut metrics: HashMap<String, FlowMetrics> = HashMap::with_capacity(docs.len());
    for d in &docs {
        // `_id` is the grouped flowId; emit hex when it's an ObjectId, else its string form.
        let flow_key = match d.get("_id") {
            Some(Bson::ObjectId(oid)) => oid.to_hex(),
            Some(Bson::String(s)) => s.clone(),
            _ => continue,
        };
        metrics.insert(
            flow_key,
            FlowMetrics {
                triggers_today: count_field(d, "triggersToday"),
                total_triggers: count_field(d, "totalTriggers"),
                last_triggered_at: d.get("lastTriggeredAt").and_then(ts_to_iso),
            },
        );
    }

    Ok(Json(BatchMetricsResponse { metrics }))
}
