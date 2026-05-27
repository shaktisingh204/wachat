use axum::{Json, extract::{Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorCheckRun;

const COLL: &str = "sabmonitor_check_runs";
const CHECKS_COLL: &str = "sabmonitor_checks";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_runs(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(c) = q.check_id.as_deref() {
        filter.insert("checkId", oid_from_str(c)?);
    }
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", s);
    }
    if let Some(r) = q.region.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("probeRegion", r);
    }
    let limit = q.limit.unwrap_or(100).min(500) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "ts": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorCheckRun>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_check_runs.find")))?;
    let mut rows: Vec<SabmonitorCheckRun> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_check_runs.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn report_run(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<ReportRunInput>) -> Result<Json<ReportRunResponse>> {
    let user_id = user_oid(&user)?;
    let check_oid = oid_from_str(&input.check_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabmonitorCheckRun {
        id: None,
        user_id,
        check_id: check_oid,
        probe_region: input.probe_region,
        ts: now,
        status: input.status.clone(),
        response_ms: input.response_ms,
        http_status_code: input.http_status_code,
        ssl_days_to_expiry: input.ssl_days_to_expiry,
        error_message: input.error_message,
        trace_json: input.trace_json,
    };
    let coll = mongo.collection::<SabmonitorCheckRun>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_check_runs.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);

    // Roll up onto the parent check row.
    let _ = mongo
        .collection::<Document>(CHECKS_COLL)
        .update_one(
            doc! { "_id": check_oid, "userId": user_id },
            doc! { "$set": { "lastRunAt": now, "lastStatus": input.status, "updatedAt": now } },
        )
        .await;

    Ok(Json(ReportRunResponse { id: id.to_hex(), entity }))
}
