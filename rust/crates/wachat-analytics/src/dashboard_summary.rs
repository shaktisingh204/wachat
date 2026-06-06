//! Dashboard summary — single-call replacement for the native
//! `getDashboardStats` + `getDashboardChartData` (`src/app/actions/dashboard.actions.ts`).
//!
//! Pure Mongo aggregation over the REAL `outgoing_messages` and `broadcasts`
//! collections — no Meta Graph. Returns the headline totals plus a 30-day
//! daily `{ date, sent, delivered, read }` series (dense, zero-filled), so the
//! `/wachat/overview` page can render its stat strip + chart from one response.
//!
//! Status taxonomy (matches the native action):
//!  - `sent`      = status ∈ { sent, delivered, read }
//!  - `delivered` = status ∈ { delivered, read }
//!  - `read`      = status == read
//!  - `failed`    = status == failed
//!
//! Returns zeros / an all-zero 30-day series (never fabricated data) when the
//! project has no messages.

use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Timelike, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use std::collections::HashMap;

const OUTGOING_COLL: &str = "outgoing_messages";
const BROADCASTS_COLL: &str = "broadcasts";

/// One day of the 30-day chart series. `date` is `YYYY-MM-DD` (UTC).
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPoint {
    pub date: String,
    pub sent: u64,
    pub delivered: u64,
    pub read: u64,
}

/// Headline totals + dense 30-day daily series, in one response.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub total_messages: u64,
    pub total_sent: u64,
    pub total_delivered: u64,
    pub total_read: u64,
    pub total_failed: u64,
    pub total_campaigns: u64,
    /// Exactly 30 entries, oldest → newest, zero-filled for empty days.
    pub daily_series: Vec<DailyPoint>,
}

pub async fn aggregate(mongo: &MongoHandle, project_id: ObjectId) -> Result<DashboardSummary> {
    let outgoing = mongo.collection::<Document>(OUTGOING_COLL);

    // --- Headline status counts over ALL outgoing messages for the project. ---
    // One $group pass instead of five countDocuments round-trips.
    let totals_pipeline = vec![
        doc! { "$match": { "projectId": project_id } },
        doc! { "$group": {
            "_id": "$status",
            "count": { "$sum": 1 },
        } },
    ];
    let totals_docs: Vec<Document> = outgoing
        .aggregate(totals_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut by_status: HashMap<String, u64> = HashMap::new();
    for d in &totals_docs {
        let status = d.get_str("_id").unwrap_or("").to_owned();
        by_status.insert(status, doc_count(d));
    }
    let count_of = |s: &str| by_status.get(s).copied().unwrap_or(0);
    let c_sent = count_of("sent");
    let c_delivered = count_of("delivered");
    let c_read = count_of("read");
    let c_failed = count_of("failed");

    let total_messages: u64 = by_status.values().copied().sum();
    // Cumulative status buckets, mirroring the native $in semantics.
    let total_sent = c_sent + c_delivered + c_read;
    let total_delivered = c_delivered + c_read;
    let total_read = c_read;
    let total_failed = c_failed;

    // --- Total campaigns = broadcasts for the project. ---
    let total_campaigns = mongo
        .collection::<Document>(BROADCASTS_COLL)
        .count_documents(doc! { "projectId": project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // --- 30-day daily chart, grouped by `createdAt` day (matches native). ---
    // Window start = 30 days ago at 00:00:00 UTC.
    let now = Utc::now();
    let start = (now - Duration::days(30))
        .with_hour(0)
        .and_then(|d| d.with_minute(0))
        .and_then(|d| d.with_second(0))
        .and_then(|d| d.with_nanosecond(0))
        .unwrap_or(now - Duration::days(30));
    let start_bson = bson::DateTime::from_chrono(start);

    let chart_pipeline = vec![
        doc! { "$match": {
            "projectId": project_id,
            "createdAt": { "$gte": start_bson },
        } },
        doc! { "$group": {
            "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$createdAt" } },
            "sent": { "$sum": { "$cond": [ { "$in": [ "$status", ["sent", "delivered", "read"] ] }, 1, 0 ] } },
            "delivered": { "$sum": { "$cond": [ { "$in": [ "$status", ["delivered", "read"] ] }, 1, 0 ] } },
            "read": { "$sum": { "$cond": [ { "$eq": [ "$status", "read" ] }, 1, 0 ] } },
        } },
    ];
    let chart_docs: Vec<Document> = outgoing
        .aggregate(chart_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut by_date: HashMap<String, (u64, u64, u64)> = HashMap::new();
    for d in &chart_docs {
        let date = d.get_str("_id").unwrap_or("").to_owned();
        by_date.insert(
            date,
            (doc_u64(d, "sent"), doc_u64(d, "delivered"), doc_u64(d, "read")),
        );
    }

    // Dense, zero-filled series of exactly 30 days, oldest → newest.
    let mut daily_series = Vec::with_capacity(30);
    for i in 0..30 {
        let day = start + Duration::days(i);
        let date = day.format("%Y-%m-%d").to_string();
        let (sent, delivered, read) = by_date.get(&date).copied().unwrap_or((0, 0, 0));
        daily_series.push(DailyPoint {
            date,
            sent,
            delivered,
            read,
        });
    }

    Ok(DashboardSummary {
        total_messages,
        total_sent,
        total_delivered,
        total_read,
        total_failed,
        total_campaigns,
        daily_series,
    })
}

/// `$sum: 1` may come back as i32 or i64 depending on the driver.
fn doc_count(d: &Document) -> u64 {
    d.get_i64("count")
        .ok()
        .map(|x| x.max(0) as u64)
        .or_else(|| d.get_i32("count").ok().map(|x| x.max(0) as u64))
        .unwrap_or(0)
}

fn doc_u64(d: &Document, key: &str) -> u64 {
    d.get_i64(key)
        .ok()
        .map(|x| x.max(0) as u64)
        .or_else(|| d.get_i32(key).ok().map(|x| x.max(0) as u64))
        .unwrap_or(0)
}
