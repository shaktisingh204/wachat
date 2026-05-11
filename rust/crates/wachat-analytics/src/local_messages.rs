//! Local message analytics — aggregates `outgoing_messages` and
//! `incoming_messages` Mongo collections by status and date.
//!
//! Mirrors `getLocalMessageAnalytics` in `whatsapp-analytics.actions.ts`.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const OUTGOING_COLL: &str = "outgoing_messages";
const INCOMING_COLL: &str = "incoming_messages";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMessageAnalyticsBody {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub start_date: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub end_date: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStat {
    pub date: String,
    pub sent: u64,
    pub delivered: u64,
    pub read: u64,
    pub failed: u64,
    pub incoming: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMessageAnalyticsResult {
    pub total_sent: u64,
    pub total_delivered: u64,
    pub total_read: u64,
    pub total_failed: u64,
    pub total_incoming: u64,
    pub daily_breakdown: Vec<DailyStat>,
}

pub async fn aggregate(
    mongo: &MongoHandle,
    project_id: ObjectId,
    body: LocalMessageAnalyticsBody,
) -> Result<LocalMessageAnalyticsResult> {
    let start = bson::DateTime::from_chrono(body.start_date);
    let end = bson::DateTime::from_chrono(body.end_date);

    let outgoing_pipeline = vec![
        doc! {
            "$match": {
                "projectId": project_id,
                "messageTimestamp": { "$gte": start, "$lte": end },
            }
        },
        doc! {
            "$group": {
                "_id": {
                    "date": { "$dateToString": { "format": "%Y-%m-%d", "date": "$messageTimestamp" } },
                    "status": "$status",
                },
                "count": { "$sum": 1 },
            }
        },
    ];
    let incoming_pipeline = vec![
        doc! {
            "$match": {
                "projectId": project_id,
                "messageTimestamp": { "$gte": start, "$lte": end },
            }
        },
        doc! {
            "$group": {
                "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$messageTimestamp" } },
                "count": { "$sum": 1 },
            }
        },
    ];

    let outgoing: Vec<Document> = mongo
        .collection::<Document>(OUTGOING_COLL)
        .aggregate(outgoing_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let incoming: Vec<Document> = mongo
        .collection::<Document>(INCOMING_COLL)
        .aggregate(incoming_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut daily: BTreeMap<String, DailyStat> = BTreeMap::new();

    for d in outgoing {
        let id = match d.get_document("_id") {
            Ok(x) => x,
            Err(_) => continue,
        };
        let date = id.get_str("date").unwrap_or("").to_string();
        let status = id.get_str("status").unwrap_or("").to_string();
        let count = doc_count(&d);
        let entry = daily.entry(date.clone()).or_insert_with(|| DailyStat {
            date,
            ..Default::default()
        });
        match status.as_str() {
            "sent" => entry.sent += count,
            "delivered" => entry.delivered += count,
            "read" => entry.read += count,
            "failed" => entry.failed += count,
            _ => {}
        }
    }
    for d in incoming {
        let date = d.get_str("_id").unwrap_or("").to_string();
        let count = doc_count(&d);
        let entry = daily.entry(date.clone()).or_insert_with(|| DailyStat {
            date,
            ..Default::default()
        });
        entry.incoming += count;
    }

    // BTreeMap iteration is already sorted by date string ascending.
    let daily_breakdown: Vec<DailyStat> = daily.into_values().collect();

    let mut totals = LocalMessageAnalyticsResult::default();
    for d in &daily_breakdown {
        totals.total_sent += d.sent;
        totals.total_delivered += d.delivered;
        totals.total_read += d.read;
        totals.total_failed += d.failed;
        totals.total_incoming += d.incoming;
    }
    totals.daily_breakdown = daily_breakdown;
    Ok(totals)
}

fn doc_count(d: &Document) -> u64 {
    // Mongo `$sum: 1` returns an i32 typically, but driver may produce i64.
    d.get_i64("count")
        .ok()
        .map(|x| x as u64)
        .or_else(|| d.get_i32("count").ok().map(|x| x as u64))
        .unwrap_or(0)
}
