//! HTTP handlers for `/v1/sabprep/runs`.
//!
//! Read-only — writes happen in `sabprep-recipes::handlers::run_recipe`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, ListResponse};
use crate::types::SabprepRun;

const RUNS_COLL: &str = "sabprep_runs";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_runs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(rid) = q.recipe_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(rid)?;
        filter.insert("recipeId", oid);
    }
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", s);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabprepRun>(RUNS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_runs.find")))?;
    let mut rows: Vec<SabprepRun> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabprep_runs.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn get_run(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
) -> Result<Json<SabprepRun>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&run_id)?;
    let coll = mongo.collection::<SabprepRun>(RUNS_COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_runs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_run".to_owned()))?;
    Ok(Json(row))
}
