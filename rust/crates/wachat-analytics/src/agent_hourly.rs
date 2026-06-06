//! Per-agent hourly response-time buckets — the drill-in behind the
//! `/wachat/response-time-tracker` agent leaderboard.
//!
//! Pure Mongo aggregation over the `messages` chat collection (the same source
//! the existing `wachat-features` agent-performance roll-up uses): outbound
//! agent messages carry a `responseTimeMs` (ms the agent took to reply) and a
//! `timestamp`. This buckets `avgResponseMs` by hour-of-day (0–23, UTC) for a
//! single agent over the last N days, plus the message count per bucket.
//!
//! Returns a dense 24-entry series (zero-filled / `avgResponseMs = 0`) so the
//! tracker can render a bar-per-hour with no client-side gap handling. No data
//! → all-zero buckets (never fabricated).

use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const MESSAGES_COLL: &str = "messages";

/// Query string for the drill-in: `?days=N` (defaults to 30, clamped 1..=365).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

/// One hour-of-day bucket. `hour` is 0–23 (UTC).
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyBucket {
    pub hour: u8,
    pub avg_response_ms: f64,
    pub message_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHourlyResult {
    pub agent_id: String,
    pub days: i64,
    pub total_messages: u64,
    /// Overall mean response time across the window, ms (0 when no data).
    pub avg_response_ms: f64,
    /// Exactly 24 entries, hour 0 → 23.
    pub buckets: Vec<HourlyBucket>,
}

pub async fn aggregate(
    mongo: &MongoHandle,
    project_id: ObjectId,
    agent_id_hex: &str,
    query: HourlyQuery,
) -> Result<AgentHourlyResult> {
    let days = query.days.unwrap_or(30).clamp(1, 365);
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(days));

    // `agentId` on the message may be stored as an ObjectId or as a hex string
    // (legacy docs) — match either so we don't silently drop history.
    let agent_oid = ObjectId::parse_str(agent_id_hex).ok();
    let mut agent_match = vec![bson::Bson::String(agent_id_hex.to_owned())];
    if let Some(oid) = agent_oid {
        agent_match.push(bson::Bson::ObjectId(oid));
    }

    let pipeline = vec![
        doc! { "$match": {
            "projectId": project_id,
            "direction": "out",
            "timestamp": { "$gte": since },
            "agentId": { "$in": agent_match },
            "responseTimeMs": { "$exists": true, "$ne": null },
        } },
        doc! { "$group": {
            "_id": { "$hour": { "date": "$timestamp" } },
            "avgResponseMs": { "$avg": "$responseTimeMs" },
            "messageCount": { "$sum": 1 },
        } },
    ];

    let docs: Vec<Document> = mongo
        .collection::<Document>(MESSAGES_COLL)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut by_hour: HashMap<u8, (f64, u64)> = HashMap::new();
    for d in &docs {
        let hour = d
            .get_i32("_id")
            .ok()
            .or_else(|| d.get_i64("_id").ok().map(|v| v as i32))
            .unwrap_or(-1);
        if !(0..=23).contains(&hour) {
            continue;
        }
        let avg = doc_f64(d, "avgResponseMs");
        let count = doc_u64(d, "messageCount");
        by_hour.insert(hour as u8, (avg, count));
    }

    let mut buckets = Vec::with_capacity(24);
    let mut total_messages = 0u64;
    let mut weighted_sum = 0f64;
    for hour in 0u8..24 {
        let (avg, count) = by_hour.get(&hour).copied().unwrap_or((0.0, 0));
        total_messages += count;
        weighted_sum += avg * count as f64;
        buckets.push(HourlyBucket {
            hour,
            avg_response_ms: avg,
            message_count: count,
        });
    }
    let avg_response_ms = if total_messages > 0 {
        weighted_sum / total_messages as f64
    } else {
        0.0
    };

    Ok(AgentHourlyResult {
        agent_id: agent_id_hex.to_owned(),
        days,
        total_messages,
        avg_response_ms,
        buckets,
    })
}

fn doc_f64(d: &Document, key: &str) -> f64 {
    d.get_f64(key)
        .ok()
        .or_else(|| d.get_i64(key).ok().map(|v| v as f64))
        .or_else(|| d.get_i32(key).ok().map(|v| v as f64))
        .unwrap_or(0.0)
}

fn doc_u64(d: &Document, key: &str) -> u64 {
    d.get_i64(key)
        .ok()
        .map(|x| x.max(0) as u64)
        .or_else(|| d.get_i32(key).ok().map(|x| x.max(0) as u64))
        .unwrap_or(0)
}
