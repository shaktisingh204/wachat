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
use crate::types::SabmonitorSyntheticScript;

const COLL: &str = "sabmonitor_synthetic_scripts";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(uid: ObjectId, id: ObjectId) -> Document { doc! { "_id": id, "userId": uid } }

#[instrument(skip_all)]
pub async fn list(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorSyntheticScript>(COLL);
    let cursor = coll.find(doc! { "userId": user_id }).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.find")))?;
    let mut rows: Vec<SabmonitorSyntheticScript> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_one(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<SabmonitorSyntheticScript>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    mongo.collection::<SabmonitorSyntheticScript>(COLL).find_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.find_one")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("synthetic_script".into()))
}

#[instrument(skip_all)]
pub async fn create(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateInput>) -> Result<Json<CreateResponse>> {
    let uid = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let mut entity = SabmonitorSyntheticScript {
        id: None,
        user_id: uid,
        name: input.name,
        steps_json: input.steps_json,
        screenshot_on_failure: input.screenshot_on_failure,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorSyntheticScript>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all)]
pub async fn update(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>, Json(patch): Json<UpdateInput>) -> Result<Json<SabmonitorSyntheticScript>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name { set.insert("name", v); }
    if let Some(v) = patch.steps_json {
        if let Ok(b) = bson::to_bson(&v) { set.insert("stepsJson", b); }
    }
    if let Some(v) = patch.screenshot_on_failure { set.insert("screenshotOnFailure", v); }
    let coll = mongo.collection::<SabmonitorSyntheticScript>(COLL);
    let r = coll.update_one(ownership(uid, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.update")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("synthetic_script".into())); }
    coll.find_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.refetch")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("synthetic_script".into()))
}

#[instrument(skip_all)]
pub async fn delete(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<DeleteResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorSyntheticScript>(COLL);
    let r = coll.delete_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_synthetic_scripts.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("synthetic_script".into())); }
    Ok(Json(DeleteResponse { deleted: true }))
}
