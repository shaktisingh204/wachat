use axum::{Json, extract::{Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorTraceSpan;

const COLL: &str = "sabmonitor_trace_spans";
const TRACES_COLL: &str = "sabmonitor_traces";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}

#[instrument(skip_all)]
pub async fn list_spans(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let uid = user_oid(&user)?;
    let mut filter = doc! { "userId": uid };
    if let Some(t) = q.trace_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("traceId", t);
    }
    if let Some(s) = q.service.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("service", s);
    }
    let limit = q.limit.unwrap_or(200).min(2000) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "startedAt": 1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorTraceSpan>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_trace_spans.find")))?;
    let mut rows: Vec<SabmonitorTraceSpan> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_trace_spans.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn ingest_span(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<IngestSpanInput>) -> Result<Json<IngestSpanResponse>> {
    let uid = user_oid(&user)?;
    let started = Utc.timestamp_millis_opt(input.started_at_ms).single()
        .ok_or_else(|| ApiError::Validation("invalid startedAtMs".into()))?;
    let entity = SabmonitorTraceSpan {
        id: None,
        user_id: uid,
        trace_id: input.trace_id.clone(),
        parent_span_id: input.parent_span_id.clone(),
        span_id: input.span_id.clone(),
        service: input.service.clone(),
        operation: input.operation.clone(),
        started_at: BsonDateTime::from_chrono(started),
        duration_ms: input.duration_ms,
        tags_json: input.tags_json,
        errored: input.errored,
    };
    let coll = mongo.collection::<SabmonitorTraceSpan>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_trace_spans.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;

    // Upsert a rolling trace summary. Only the root span (no parent) seeds
    // rootService / rootOperation; every span bumps spanCount and OR-s
    // errored.
    let mut set_on_insert = doc! { "createdAt": BsonDateTime::from_chrono(Utc::now()) };
    if input.parent_span_id.is_none() {
        set_on_insert.insert("rootService", input.service.clone());
        set_on_insert.insert("rootOperation", input.operation.clone());
        set_on_insert.insert("startedAt", BsonDateTime::from_chrono(started));
        set_on_insert.insert("durationMs", input.duration_ms);
    }
    let update = doc! {
        "$setOnInsert": set_on_insert,
        "$inc": { "spanCount": 1 },
        "$max": { "errored": input.errored },
        "$set": { "userId": uid, "traceId": input.trace_id.clone(), "updatedAt": BsonDateTime::from_chrono(Utc::now()) },
    };
    let opts = mongodb::options::UpdateOptions::builder().upsert(true).build();
    let _ = mongo.collection::<Document>(TRACES_COLL)
        .update_one(doc! { "traceId": &input.trace_id, "userId": uid }, update)
        .with_options(opts)
        .await;

    Ok(Json(IngestSpanResponse { id: id.to_hex() }))
}
