//! HTTP handlers for the SabChat reports / analytics router.
//!
//! Every route is **GET-only** and tenant-scoped: the caller's
//! `auth.tenant_id` is parsed into a BSON `ObjectId` and used as the
//! leading filter on every aggregation. The handlers stay slim — all
//! Mongo pipeline construction lives in [`crate::pipelines`].
//!
//! ## Time windows
//!
//! Routes that accept `?from=&to=` accept RFC 3339 strings; an absent
//! value defaults to "now" (`to`) or "now − 7 days" (`from`) per the
//! [`crate::dto::DEFAULT_WINDOW_DAYS`] constant. The interval is
//! half-open `[from, to)` to match the convention used by
//! `sabchat-audit`.
//!
//! ## Errors
//!
//! Bad RFC 3339 input → `400 Bad Request`. Malformed `tid` claim →
//! `401 Unauthorized`. Anything thrown by the Mongo driver → `500
//! Internal` with the original error chained via `anyhow`.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::dto::{
    AgentBreakdown, ByAgentResponse, ByChannelResponse, ByInboxResponse, ChannelBreakdown,
    CsatBucket, CsatResponse, DEFAULT_WINDOW_DAYS, InboxBreakdown, InboxQueueEntry, LiveResponse,
    MAX_VOLUME_BUCKETS, ResponseTimesResponse, VolumeBucket, VolumeGroupBy, VolumeQuery,
    VolumeResponse, WindowQuery,
};
use crate::pipelines::{
    build_by_agent_pipeline, build_by_inbox_pipeline, build_csat_pipeline, build_live_pipeline,
    build_response_times_pipeline, build_volume_conversations_pipeline,
    build_volume_messages_pipeline,
};
use crate::state::SabChatReportsState;
use crate::{ASSIGNMENTS_COLL, CONVERSATIONS_COLL};

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`. A
/// malformed claim is `401 Unauthorized` — there is no tenant-less
/// report.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Resolve a `[from, to)` window from optional RFC 3339 strings. Either
/// side may be omitted; the defaults are `to = now`, `from = to − 7d`.
fn resolve_window(from: Option<&str>, to: Option<&str>) -> Result<(DateTime<Utc>, DateTime<Utc>)> {
    let to_dt = match to.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => parse_rfc3339("to", raw)?,
        None => Utc::now(),
    };
    let from_dt = match from.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => parse_rfc3339("from", raw)?,
        None => to_dt - Duration::days(DEFAULT_WINDOW_DAYS),
    };
    if from_dt > to_dt {
        return Err(ApiError::BadRequest(
            "`from` must be earlier than or equal to `to`".to_owned(),
        ));
    }
    Ok((from_dt, to_dt))
}

fn parse_rfc3339(field: &str, raw: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| ApiError::BadRequest(format!("invalid RFC3339 timestamp for `{field}`: {e}")))
}

/// Convert chrono → bson datetime in one place.
fn to_bson_dt(dt: DateTime<Utc>) -> bson::DateTime {
    bson::DateTime::from_chrono(dt)
}

/// Pull an `i64` count out of a `$group`/`$sum` result, tolerating
/// both `i32` and `i64` shapes that the Mongo driver may return.
fn doc_i64(d: &Document, field: &str) -> i64 {
    d.get_i64(field)
        .ok()
        .or_else(|| d.get_i32(field).ok().map(i64::from))
        .unwrap_or(0)
}

fn doc_f64(d: &Document, field: &str) -> f64 {
    d.get_f64(field)
        .ok()
        .or_else(|| d.get_i64(field).ok().map(|n| n as f64))
        .or_else(|| d.get_i32(field).ok().map(f64::from))
        .unwrap_or(0.0)
}

fn doc_str(d: &Document, field: &str) -> String {
    d.get_str(field).unwrap_or("").to_owned()
}

/// Wrap any Mongo driver error into `ApiError::Internal` with a stage
/// label so log lines pinpoint the failing pipeline.
fn mongo_err(stage: &'static str) -> impl FnOnce(mongodb::error::Error) -> ApiError {
    move |e| ApiError::Internal(anyhow::Error::new(e).context(stage))
}

// ===========================================================================
// GET /live
// ===========================================================================

/// `GET /live` — single aggregation snapshot of the live queue.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn live(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
) -> Result<Json<LiveResponse>> {
    let tenant = tenant_oid(&user)?;
    let now = to_bson_dt(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let pipeline = build_live_pipeline(tenant, now);
    let docs: Vec<Document> = coll
        .aggregate(pipeline)
        .await
        .map_err(mongo_err("sabchat_reports.live.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.live.collect"))?;

    // `$facet` always returns a single document with the two arrays.
    let root = docs.into_iter().next().unwrap_or_default();

    let totals = root
        .get_array("totals")
        .ok()
        .and_then(|arr| arr.first())
        .and_then(|b| b.as_document())
        .cloned()
        .unwrap_or_default();

    let queue_arr = root.get_array("queue").cloned().unwrap_or_default();

    let queue_by_inbox: Vec<InboxQueueEntry> = queue_arr
        .iter()
        .filter_map(|b| b.as_document())
        .map(|d| InboxQueueEntry {
            inbox_id: doc_str(d, "inboxId"),
            name: doc_str(d, "name"),
            count: doc_i64(d, "count"),
        })
        .collect();

    Ok(Json(LiveResponse {
        open_count: doc_i64(&totals, "openCount"),
        pending_count: doc_i64(&totals, "pendingCount"),
        snoozed_count: doc_i64(&totals, "snoozedCount"),
        sla_breached_count: doc_i64(&totals, "slaBreachedCount"),
        longest_wait_minutes: doc_f64(&totals, "longestWaitMinutes"),
        queue_by_inbox,
    }))
}

// ===========================================================================
// GET /volume
// ===========================================================================

/// `GET /volume` — conversation + message buckets across the window.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn volume(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<VolumeQuery>,
) -> Result<Json<VolumeResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;
    let group_by = query.group_by.unwrap_or_default();
    let from_b = to_bson_dt(from);
    let to_b = to_bson_dt(to);

    let conv_coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let msg_coll = state.mongo.collection::<Document>(crate::MESSAGES_COLL);

    let conv_docs: Vec<Document> = conv_coll
        .aggregate(build_volume_conversations_pipeline(
            tenant, from_b, to_b, group_by,
        ))
        .await
        .map_err(mongo_err("sabchat_reports.volume.conversations.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.volume.conversations.collect"))?;

    let msg_docs: Vec<Document> = msg_coll
        .aggregate(build_volume_messages_pipeline(
            tenant, from_b, to_b, group_by,
        ))
        .await
        .map_err(mongo_err("sabchat_reports.volume.messages.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.volume.messages.collect"))?;

    // Merge by bucket key. `BTreeMap` keeps natural ascending order on
    // the string key — both date and ISO-week formats sort correctly
    // lexicographically.
    let mut buckets: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    for d in conv_docs {
        let key = d.get_str("_id").unwrap_or("").to_owned();
        let n = doc_i64(&d, "count");
        buckets.entry(key).or_insert((0, 0)).0 = n;
    }
    for d in msg_docs {
        let key = d.get_str("_id").unwrap_or("").to_owned();
        let n = doc_i64(&d, "count");
        buckets.entry(key).or_insert((0, 0)).1 = n;
    }

    let mut out: Vec<VolumeBucket> = buckets
        .into_iter()
        .map(|(at, (conversations, messages))| VolumeBucket {
            at: format_bucket_at(&at, group_by),
            conversations,
            messages,
        })
        .collect();

    // Cap at MAX_VOLUME_BUCKETS — keep the most recent buckets so the
    // dashboard still shows "now".
    if out.len() > MAX_VOLUME_BUCKETS {
        let drop = out.len() - MAX_VOLUME_BUCKETS;
        out.drain(0..drop);
    }

    Ok(Json(VolumeResponse { buckets: out }))
}

/// Normalise the `$dateToString` bucket key into an RFC 3339-ish form
/// that the frontend can `Date.parse`. `day` / `hour` formats already
/// parse natively; ISO-week (`%G-W%V`) does not, so we leave it
/// verbatim — clients are expected to render week labels as-is.
fn format_bucket_at(raw: &str, group_by: VolumeGroupBy) -> String {
    match group_by {
        VolumeGroupBy::Day => format!("{raw}T00:00:00Z"),
        VolumeGroupBy::Hour | VolumeGroupBy::Week => raw.to_owned(),
    }
}

// ===========================================================================
// GET /response-times
// ===========================================================================

/// `GET /response-times` — mean / p50 / p95 / p99 of first-response
/// latency. Mongo emits the sorted minute-latency list; the
/// percentiles are computed in Rust to keep the driver-feature surface
/// narrow (server-side `$percentile` is 7.0+).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn response_times(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<WindowQuery>,
) -> Result<Json<ResponseTimesResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let docs: Vec<Document> = coll
        .aggregate(build_response_times_pipeline(
            tenant,
            to_bson_dt(from),
            to_bson_dt(to),
        ))
        .await
        .map_err(mongo_err("sabchat_reports.response_times.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.response_times.collect"))?;

    let latencies: Vec<f64> = docs.iter().map(|d| doc_f64(d, "latencyMin")).collect();
    let count = latencies.len() as i64;
    if count == 0 {
        return Ok(Json(ResponseTimesResponse {
            count: 0,
            mean: 0.0,
            p50: 0.0,
            p95: 0.0,
            p99: 0.0,
        }));
    }

    let sum: f64 = latencies.iter().sum();
    let mean = sum / (count as f64);

    // Already sorted ascending by the pipeline's `$sort`.
    let p = |q: f64| -> f64 {
        if latencies.is_empty() {
            return 0.0;
        }
        let idx = ((latencies.len() as f64 - 1.0) * q).round() as usize;
        latencies[idx.min(latencies.len() - 1)]
    };

    Ok(Json(ResponseTimesResponse {
        count,
        mean,
        p50: p(0.50),
        p95: p(0.95),
        p99: p(0.99),
    }))
}

// ===========================================================================
// GET /by-agent
// ===========================================================================

/// `GET /by-agent` — per-agent breakdown across the window.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn by_agent(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<WindowQuery>,
) -> Result<Json<ByAgentResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;

    let coll = state.mongo.collection::<Document>(ASSIGNMENTS_COLL);
    let docs: Vec<Document> = coll
        .aggregate(build_by_agent_pipeline(
            tenant,
            to_bson_dt(from),
            to_bson_dt(to),
        ))
        .await
        .map_err(mongo_err("sabchat_reports.by_agent.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.by_agent.collect"))?;

    let agents: Vec<AgentBreakdown> = docs
        .iter()
        .map(|d| AgentBreakdown {
            agent_id: doc_str(d, "agentId"),
            conversations_handled: doc_i64(d, "conversationsHandled"),
            avg_first_response_min: doc_f64(d, "avgFirstResponseMin"),
            resolved_count: doc_i64(d, "resolvedCount"),
            open_count: doc_i64(d, "openCount"),
        })
        .collect();

    Ok(Json(ByAgentResponse { agents }))
}

// ===========================================================================
// GET /by-inbox
// ===========================================================================

/// `GET /by-inbox` — per-inbox breakdown joined with inbox metadata.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn by_inbox(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<WindowQuery>,
) -> Result<Json<ByInboxResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;

    let inboxes = collect_by_inbox(&state, tenant, from, to).await?;
    Ok(Json(ByInboxResponse { inboxes }))
}

/// Shared collector used by both `/by-inbox` and `/by-channel`.
async fn collect_by_inbox(
    state: &SabChatReportsState,
    tenant: ObjectId,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<InboxBreakdown>> {
    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let docs: Vec<Document> = coll
        .aggregate(build_by_inbox_pipeline(
            tenant,
            to_bson_dt(from),
            to_bson_dt(to),
        ))
        .await
        .map_err(mongo_err("sabchat_reports.by_inbox.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.by_inbox.collect"))?;

    Ok(docs
        .iter()
        .map(|d| InboxBreakdown {
            inbox_id: doc_str(d, "inboxId"),
            name: doc_str(d, "name"),
            channel_type: doc_str(d, "channelType"),
            conversations_created: doc_i64(d, "conversationsCreated"),
            messages_sent: doc_i64(d, "messagesSent"),
            avg_first_response_min: doc_f64(d, "avgFirstResponseMin"),
            resolved_count: doc_i64(d, "resolvedCount"),
        })
        .collect())
}

// ===========================================================================
// GET /by-channel
// ===========================================================================

/// `GET /by-channel` — channel roll-up of `/by-inbox`. Re-uses the same
/// per-inbox pipeline and folds the resulting rows in Rust so the
/// avg-first-response remains conversation-count-weighted.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn by_channel(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<WindowQuery>,
) -> Result<Json<ByChannelResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;

    let rows = collect_by_inbox(&state, tenant, from, to).await?;

    // Fold by channelType, carrying a running weighted-mean numerator.
    struct ChAgg {
        conversations_created: i64,
        messages_sent: i64,
        resolved_count: i64,
        /// Sum of (avgFirstResponseMin * conversations_created) per
        /// inbox — divided out at emit time.
        weighted_latency: f64,
        weight: i64,
    }
    let mut acc: BTreeMap<String, ChAgg> = BTreeMap::new();
    for row in rows {
        let entry = acc.entry(row.channel_type.clone()).or_insert(ChAgg {
            conversations_created: 0,
            messages_sent: 0,
            resolved_count: 0,
            weighted_latency: 0.0,
            weight: 0,
        });
        entry.conversations_created += row.conversations_created;
        entry.messages_sent += row.messages_sent;
        entry.resolved_count += row.resolved_count;
        if row.avg_first_response_min > 0.0 && row.conversations_created > 0 {
            entry.weighted_latency +=
                row.avg_first_response_min * (row.conversations_created as f64);
            entry.weight += row.conversations_created;
        }
    }

    let channels: Vec<ChannelBreakdown> = acc
        .into_iter()
        .map(|(channel_type, a)| ChannelBreakdown {
            channel_type,
            conversations_created: a.conversations_created,
            messages_sent: a.messages_sent,
            resolved_count: a.resolved_count,
            avg_first_response_min: if a.weight > 0 {
                a.weighted_latency / (a.weight as f64)
            } else {
                0.0
            },
        })
        .collect();

    Ok(Json(ByChannelResponse { channels }))
}

// ===========================================================================
// GET /csat
// ===========================================================================

/// `GET /csat` — count / mean / distribution over
/// `customAttrs.csat.score`. When no qualifying conversations exist
/// the response is `{ count: 0, mean: 0, distribution: [] }`.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn csat(
    user: AuthUser,
    State(state): State<SabChatReportsState>,
    Query(query): Query<WindowQuery>,
) -> Result<Json<CsatResponse>> {
    let tenant = tenant_oid(&user)?;
    let (from, to) = resolve_window(query.from.as_deref(), query.to.as_deref())?;

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let docs: Vec<Document> = coll
        .aggregate(build_csat_pipeline(
            tenant,
            to_bson_dt(from),
            to_bson_dt(to),
        ))
        .await
        .map_err(mongo_err("sabchat_reports.csat.aggregate"))?
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_reports.csat.collect"))?;

    if docs.is_empty() {
        return Ok(Json(CsatResponse {
            count: 0,
            mean: 0.0,
            distribution: Vec::new(),
        }));
    }

    let mut sum: f64 = 0.0;
    let mut dist: BTreeMap<i64, i64> = BTreeMap::new();
    for d in &docs {
        // `score` may be persisted as int or double — try both.
        let score = d
            .get_i64("score")
            .ok()
            .or_else(|| d.get_i32("score").ok().map(i64::from))
            .or_else(|| d.get_f64("score").ok().map(|f| f.round() as i64));
        if let Some(s) = score {
            sum += s as f64;
            *dist.entry(s).or_insert(0) += 1;
        }
    }
    let count = docs.len() as i64;
    let mean = if count > 0 { sum / (count as f64) } else { 0.0 };

    Ok(Json(CsatResponse {
        count,
        mean,
        distribution: dist
            .into_iter()
            .map(|(score, count)| CsatBucket { score, count })
            .collect(),
    }))
}

// ===========================================================================
// Tiny inline tests — keep these unit-only (no Mongo).
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_window_defaults_to_last_seven_days() {
        let (from, to) = resolve_window(None, None).expect("default window");
        let delta = to - from;
        // Default window is exactly DEFAULT_WINDOW_DAYS days.
        assert_eq!(delta.num_days(), DEFAULT_WINDOW_DAYS);
    }

    #[test]
    fn resolve_window_rejects_inverted_range() {
        let err = resolve_window(Some("2026-01-02T00:00:00Z"), Some("2026-01-01T00:00:00Z"))
            .expect_err("from > to should be rejected");
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn resolve_window_rejects_malformed_input() {
        let err =
            resolve_window(Some("not-a-date"), None).expect_err("garbage `from` should error");
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn doc_i64_tolerates_i32_results() {
        let d = doc! { "count": 42_i32 };
        assert_eq!(doc_i64(&d, "count"), 42);
    }
}
