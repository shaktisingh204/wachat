//! Read-side aggregations over `apiRequestLog`.
//!
//! Every aggregation is keyed by `tenantId` so a developer can only see
//! traffic for their own keys. Defaults to the last 24 hours when the
//! caller doesn't pass an explicit window.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;

use crate::dto::{ByKeyRow, LogRow, Summary, TopRow};

pub const LOG_COLL: &str = "apiRequestLog";

const DEFAULT_TOP_LIMIT: i64 = 25;
const MAX_TOP_LIMIT: i64 = 100;
const DEFAULT_LOGS_LIMIT: i64 = 50;
const MAX_LOGS_LIMIT: i64 = 200;

fn parse_window(from: Option<&str>, to: Option<&str>) -> Result<(DateTime<Utc>, DateTime<Utc>)> {
    let now = Utc::now();
    let to_dt = match to {
        Some(s) => s
            .parse::<DateTime<Utc>>()
            .map_err(|_| ApiError::BadRequest("Invalid `to` timestamp.".to_owned()))?,
        None => now,
    };
    let from_dt = match from {
        Some(s) => s
            .parse::<DateTime<Utc>>()
            .map_err(|_| ApiError::BadRequest("Invalid `from` timestamp.".to_owned()))?,
        None => to_dt - Duration::hours(24),
    };
    if from_dt >= to_dt {
        return Err(ApiError::BadRequest(
            "`from` must be earlier than `to`.".to_owned(),
        ));
    }
    Ok((from_dt, to_dt))
}

fn window_filter(tenant_id: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> Document {
    doc! {
        "tenantId": tenant_id,
        "ts": {
            "$gte": bson::DateTime::from_chrono(from),
            "$lt": bson::DateTime::from_chrono(to),
        }
    }
}

/* ── /summary ──────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct AggSummaryRow {
    total: Option<i64>,
    errors: Option<i64>,
    avg: Option<f64>,
    /// Sorted ascending; we pick the index at len * 0.95 for p95.
    latencies: Option<Vec<i64>>,
}

pub async fn summary(
    mongo: &MongoHandle,
    tenant_id: &str,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Summary> {
    let (from_dt, to_dt) = parse_window(from, to)?;
    let coll = mongo.collection::<Document>(LOG_COLL);

    let pipeline = vec![
        doc! { "$match": window_filter(tenant_id, from_dt, to_dt) },
        doc! { "$sort": { "latencyMs": 1 } },
        doc! {
            "$group": {
                "_id": null,
                "total": { "$sum": 1_i64 },
                "errors": { "$sum": { "$cond": [{ "$gte": ["$status", 400] }, 1_i64, 0_i64] } },
                "avg": { "$avg": "$latencyMs" },
                "latencies": { "$push": "$latencyMs" },
            }
        },
    ];
    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.aggregate")))?;
    let row: Option<AggSummaryRow> = if let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.aggregate.next"))
    })? {
        Some(bson::from_document(d).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.aggregate.decode"))
        })?)
    } else {
        None
    };

    let (total, errors, avg, p95) = match row {
        Some(r) => {
            let lats = r.latencies.unwrap_or_default();
            let p95_idx = ((lats.len() as f64) * 0.95).floor() as usize;
            let p95 = lats.get(p95_idx.min(lats.len().saturating_sub(1))).copied().unwrap_or(0);
            (
                r.total.unwrap_or(0).max(0) as u64,
                r.errors.unwrap_or(0).max(0) as u64,
                r.avg.unwrap_or(0.0),
                p95 as f64,
            )
        }
        None => (0, 0, 0.0, 0.0),
    };

    Ok(Summary {
        from: from_dt.to_rfc3339(),
        to: to_dt.to_rfc3339(),
        total_requests: total,
        error_requests: errors,
        avg_latency_ms: avg,
        p95_latency_ms: p95,
    })
}

/* ── /top ──────────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct TopAggRow {
    #[serde(rename = "_id")]
    id: TopAggKey,
    count: Option<i64>,
    errors: Option<i64>,
    avg: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct TopAggKey {
    path: Option<String>,
    method: Option<String>,
}

pub async fn top(
    mongo: &MongoHandle,
    tenant_id: &str,
    from: Option<&str>,
    to: Option<&str>,
    limit: Option<i64>,
) -> Result<Vec<TopRow>> {
    let (from_dt, to_dt) = parse_window(from, to)?;
    let cap = limit.unwrap_or(DEFAULT_TOP_LIMIT).clamp(1, MAX_TOP_LIMIT);
    let coll = mongo.collection::<Document>(LOG_COLL);
    let pipeline = vec![
        doc! { "$match": window_filter(tenant_id, from_dt, to_dt) },
        doc! {
            "$group": {
                "_id": { "path": "$path", "method": "$method" },
                "count": { "$sum": 1_i64 },
                "errors": { "$sum": { "$cond": [{ "$gte": ["$status", 400] }, 1_i64, 0_i64] } },
                "avg": { "$avg": "$latencyMs" },
            }
        },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": cap },
    ];
    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.aggregate")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.collect")))?;
    let mut out = Vec::with_capacity(docs.len());
    for d in docs {
        let row: TopAggRow = bson::from_document(d)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.decode")))?;
        out.push(TopRow {
            path: row.id.path.unwrap_or_default(),
            method: row.id.method.unwrap_or_default(),
            count: row.count.unwrap_or(0).max(0) as u64,
            error_count: row.errors.unwrap_or(0).max(0) as u64,
            avg_latency_ms: row.avg.unwrap_or(0.0),
        });
    }
    Ok(out)
}

/* ── /by-key ───────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct ByKeyAggRow {
    #[serde(rename = "_id")]
    id: ByKeyAggKey,
    count: Option<i64>,
    errors: Option<i64>,
    last: Option<bson::DateTime>,
}

#[derive(Debug, Deserialize)]
struct ByKeyAggKey {
    key_id: Option<String>,
    kind: Option<String>,
    env: Option<String>,
}

pub async fn by_key(
    mongo: &MongoHandle,
    tenant_id: &str,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<ByKeyRow>> {
    let (from_dt, to_dt) = parse_window(from, to)?;
    let coll = mongo.collection::<Document>(LOG_COLL);
    let pipeline = vec![
        doc! { "$match": window_filter(tenant_id, from_dt, to_dt) },
        doc! {
            "$group": {
                "_id": { "key_id": "$keyId", "kind": "$kind", "env": "$env" },
                "count": { "$sum": 1_i64 },
                "errors": { "$sum": { "$cond": [{ "$gte": ["$status", 400] }, 1_i64, 0_i64] } },
                "last": { "$max": "$ts" },
            }
        },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": 200_i64 },
    ];
    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.aggregate")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.collect")))?;
    let mut out = Vec::with_capacity(docs.len());
    for d in docs {
        let row: ByKeyAggRow = bson::from_document(d)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.decode")))?;
        out.push(ByKeyRow {
            key_id: row.id.key_id.unwrap_or_default(),
            kind: row.id.kind.unwrap_or_default(),
            env: row.id.env.unwrap_or_default(),
            count: row.count.unwrap_or(0).max(0) as u64,
            error_count: row.errors.unwrap_or(0).max(0) as u64,
            last_used_at: row.last.map(|d| {
                d.try_to_rfc3339_string()
                    .unwrap_or_else(|_| d.to_chrono().to_rfc3339())
            }),
        });
    }
    Ok(out)
}

/* ── /logs ─────────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct LogDoc {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    status: Option<i32>,
    #[serde(default, rename = "latencyMs")]
    latency_ms: Option<i64>,
    #[serde(default, rename = "keyId")]
    key_id: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    env: Option<String>,
    #[serde(default, rename = "requestId")]
    request_id: Option<String>,
    #[serde(default, rename = "errorType")]
    error_type: Option<String>,
    #[serde(default, rename = "userAgent")]
    user_agent: Option<String>,
    #[serde(default)]
    ts: Option<bson::DateTime>,
}

pub struct LogPageResult {
    pub rows: Vec<LogRow>,
    pub next_cursor: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub async fn logs(
    mongo: &MongoHandle,
    tenant_id: &str,
    from: Option<&str>,
    to: Option<&str>,
    key_id: Option<&str>,
    path: Option<&str>,
    min_status: Option<i32>,
    cursor: Option<&str>,
    limit: Option<i64>,
) -> Result<LogPageResult> {
    let (from_dt, to_dt) = parse_window(from, to)?;
    let cap = limit.unwrap_or(DEFAULT_LOGS_LIMIT).clamp(1, MAX_LOGS_LIMIT);

    let mut filter = window_filter(tenant_id, from_dt, to_dt);
    if let Some(k) = key_id {
        filter.insert("keyId", k);
    }
    if let Some(p) = path {
        filter.insert("path", p);
    }
    if let Some(s) = min_status {
        filter.insert("status", doc! { "$gte": s });
    }
    if let Some(c) = cursor {
        if let Ok(oid) = ObjectId::parse_str(c) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }

    let coll = mongo.collection::<LogDoc>(LOG_COLL);
    let cursor_db = coll
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(cap + 1)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.find")))?;
    let mut rows: Vec<LogDoc> = cursor_db
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("apiRequestLog.collect")))?;

    let has_more = rows.len() as i64 > cap;
    if has_more {
        rows.truncate(cap as usize);
    }
    let next_cursor = if has_more {
        rows.last().map(|r| r.id.to_hex())
    } else {
        None
    };

    let data = rows
        .into_iter()
        .map(|r| LogRow {
            id: r.id.to_hex(),
            method: r.method.unwrap_or_default(),
            path: r.path.unwrap_or_default(),
            status: r.status.unwrap_or(0),
            latency_ms: r.latency_ms.unwrap_or(0),
            key_id: r.key_id.unwrap_or_default(),
            kind: r.kind.unwrap_or_default(),
            env: r.env.unwrap_or_default(),
            request_id: r.request_id,
            error_type: r.error_type,
            user_agent: r.user_agent,
            ts: r
                .ts
                .map(|d| {
                    d.try_to_rfc3339_string()
                        .unwrap_or_else(|_| d.to_chrono().to_rfc3339())
                })
                .unwrap_or_default(),
        })
        .collect();

    Ok(LogPageResult {
        rows: data,
        next_cursor,
    })
}
