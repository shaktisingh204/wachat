//! Ingest + read handlers for raw heatmap events.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::{TimeZone, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{EventsQuery, IngestBatch, IngestResponse};
use crate::types::{HeatmapEvent, HeatmapEventType};

const COLL: &str = "pagesense_heatmap_events";
const MAX_BATCH: usize = 500;
const MAX_LIMIT: i64 = 5_000;

fn event_type_from_str(s: &str) -> Option<HeatmapEventType> {
    match s.to_ascii_lowercase().as_str() {
        "click" => Some(HeatmapEventType::Click),
        "move" => Some(HeatmapEventType::Move),
        "scroll" => Some(HeatmapEventType::Scroll),
        _ => None,
    }
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %batch.site_id, n_events = batch.events.len()))]
pub async fn ingest_batch(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(batch): Json<IngestBatch>,
) -> Result<Json<IngestResponse>> {
    let user_id = oid_from_str(&user.user_id)?;
    let site_id = oid_from_str(&batch.site_id)?;

    if batch.events.is_empty() {
        return Ok(Json(IngestResponse {
            accepted: 0,
            rejected: 0,
        }));
    }
    if batch.events.len() > MAX_BATCH {
        return Err(ApiError::Validation(format!(
            "batch too large: max {} events",
            MAX_BATCH
        )));
    }

    let now = Utc::now();
    let docs: Vec<HeatmapEvent> = batch
        .events
        .into_iter()
        .map(|e| {
            let ts =
                e.ts.and_then(|ms| Utc.timestamp_millis_opt(ms).single())
                    .unwrap_or(now);
            HeatmapEvent {
                id: None,
                user_id,
                site_id,
                url: e.url,
                event_type: e.event_type,
                x: e.x,
                y: e.y,
                viewport_w: e.viewport_w,
                viewport_h: e.viewport_h,
                session_id: e.session_id,
                variant: e.variant,
                ts: BsonDateTime::from_chrono(ts),
            }
        })
        .collect();
    let accepted = docs.len() as u32;

    let coll = mongo.collection::<HeatmapEvent>(COLL);
    coll.insert_many(docs).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmap_events.insert_many"))
    })?;

    Ok(Json(IngestResponse {
        accepted,
        rejected: 0,
    }))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<HeatmapEvent>,
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %q.site_id))]
pub async fn list_events(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<EventsQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = oid_from_str(&user.user_id)?;
    let site_id = oid_from_str(&q.site_id)?;

    let mut filter: Document = doc! { "userId": user_id, "siteId": site_id };
    if let Some(url) = q.url.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("url", url);
    }
    if let Some(et) = q.event_type.as_deref().and_then(event_type_from_str) {
        let s = match et {
            HeatmapEventType::Click => "click",
            HeatmapEventType::Move => "move",
            HeatmapEventType::Scroll => "scroll",
        };
        filter.insert("eventType", s);
    }
    if q.from_ms.is_some() || q.to_ms.is_some() {
        let mut ts_clause = Document::new();
        if let Some(from) = q
            .from_ms
            .and_then(|ms| Utc.timestamp_millis_opt(ms).single())
        {
            ts_clause.insert("$gte", BsonDateTime::from_chrono(from));
        }
        if let Some(to) = q.to_ms.and_then(|ms| Utc.timestamp_millis_opt(ms).single()) {
            ts_clause.insert("$lte", BsonDateTime::from_chrono(to));
        }
        filter.insert("ts", ts_clause);
    }

    let limit = q.limit.unwrap_or(1_000).min(MAX_LIMIT as u32) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "ts": -1 })
        .limit(limit)
        .build();

    let coll = mongo.collection::<HeatmapEvent>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmap_events.find"))
    })?;
    let rows: Vec<HeatmapEvent> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmap_events.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_event_type_lowercase() {
        assert_eq!(event_type_from_str("click"), Some(HeatmapEventType::Click));
        assert_eq!(event_type_from_str("MOVE"), Some(HeatmapEventType::Move));
        assert_eq!(event_type_from_str("nope"), None);
    }
}
