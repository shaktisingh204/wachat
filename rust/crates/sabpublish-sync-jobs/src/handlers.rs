//! HTTP handlers for SabPublish sync jobs.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CompleteJobInput, CreateJobInput, CreateJobResponse, ListQuery};
use crate::types::SabpublishSyncJob;

const COLL: &str = "sabpublish_sync_jobs";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishSyncJob>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_jobs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(loc) = q.location_id.as_deref() {
        filter.insert("locationId", oid_from_str(loc)?);
    }
    if let Some(p) = q.provider_id.as_deref() {
        filter.insert("providerId", p);
    }
    if let Some(s) = q.status.as_deref() {
        filter.insert("status", s);
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 500) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabpublishSyncJob>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sync_jobs.find")))?;
    let items: Vec<SabpublishSyncJob> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sync_jobs.collect")))?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateJobInput>,
) -> Result<Json<CreateJobResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    if !matches!(input.kind.as_str(), "push" | "pull" | "verify") {
        return Err(ApiError::Validation(
            "kind must be push|pull|verify".to_owned(),
        ));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabpublishSyncJob {
        id: None,
        user_id,
        location_id: loc,
        provider_id: input.provider_id,
        kind: input.kind,
        status: input.status.unwrap_or_else(|| "queued".to_owned()),
        started_at: now,
        finished_at: None,
        error_message: None,
        changed_fields_count: 0,
        created_at: now,
    };
    let coll = mongo.collection::<SabpublishSyncJob>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sync_jobs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateJobResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, job_id = %id))]
pub async fn complete_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<CompleteJobInput>,
) -> Result<Json<SabpublishSyncJob>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "status": &input.status, "finishedAt": now };
    if let Some(err) = input.error_message.as_deref() {
        set.insert("errorMessage", err);
    }
    if let Some(n) = input.changed_fields_count {
        set.insert("changedFieldsCount", n as i32);
    }
    let coll = mongo.collection::<SabpublishSyncJob>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sync_jobs.complete")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sync job".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sync_jobs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sync job".to_owned()))?;
    Ok(Json(after))
}
