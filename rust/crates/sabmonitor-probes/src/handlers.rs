use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorProbe;

const COLL: &str = "sabmonitor_probes";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(user_id: ObjectId, id: ObjectId) -> Document {
    doc! { "_id": id, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_probes(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(r) = q.region.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("region", r);
    }
    let limit = q.limit.unwrap_or(50).min(100) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorProbe>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.find")))?;
    let mut rows: Vec<SabmonitorProbe> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_probe(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<SabmonitorProbe>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorProbe>(COLL);
    coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.find_one")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("probe".into()))
}

#[instrument(skip_all)]
pub async fn create_probe(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateProbeInput>) -> Result<Json<CreateProbeResponse>> {
    let user_id = user_oid(&user)?;
    if input.region.trim().is_empty() {
        return Err(ApiError::Validation("region is required".into()));
    }
    let mut entity = SabmonitorProbe {
        id: None,
        user_id,
        region: input.region,
        label: input.label,
        status: "offline".to_owned(),
        last_seen_at: None,
        version: input.version,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorProbe>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateProbeResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all)]
pub async fn update_probe(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>, Json(patch): Json<UpdateProbeInput>) -> Result<Json<SabmonitorProbe>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.label { set.insert("label", v); }
    if let Some(v) = patch.status { set.insert("status", v); }
    if let Some(v) = patch.version { set.insert("version", v); }
    if patch.heartbeat.unwrap_or(false) {
        set.insert("lastSeenAt", now);
        set.insert("status", "online");
    }
    let coll = mongo.collection::<SabmonitorProbe>(COLL);
    let r = coll.update_one(ownership(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.update")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("probe".into())); }
    coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.refetch")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("probe".into()))
}

#[instrument(skip_all)]
pub async fn delete_probe(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<DeleteProbeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorProbe>(COLL);
    let r = coll.delete_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_probes.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("probe".into())); }
    Ok(Json(DeleteProbeResponse { deleted: true }))
}
