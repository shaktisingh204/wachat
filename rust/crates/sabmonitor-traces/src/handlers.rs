use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorTrace;

const COLL: &str = "sabmonitor_traces";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id)
        .map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}

#[instrument(skip_all)]
pub async fn list_traces(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let uid = user_oid(&user)?;
    let mut filter = doc! { "userId": uid };
    if q.errored_only.unwrap_or(false) {
        filter.insert("errored", true);
    }
    if let Some(slow) = q.slow_ms {
        filter.insert("durationMs", doc! { "$gte": slow });
    }
    if let Some(s) = q.service.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("rootService", s);
    }
    let limit = q.limit.unwrap_or(50).min(500) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmonitorTrace>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_traces.find"))
        })?;
    let mut rows: Vec<SabmonitorTrace> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_traces.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all)]
pub async fn get_trace(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(trace_id): Path<String>,
) -> Result<Json<SabmonitorTrace>> {
    let uid = user_oid(&user)?;
    let coll = mongo.collection::<SabmonitorTrace>(COLL);
    coll.find_one(doc! { "userId": uid, "traceId": &trace_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_traces.find_one"))
        })?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("trace".into()))
}
