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
use crate::types::SabmonitorApiTransaction;

const COLL: &str = "sabmonitor_api_transactions";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(uid: ObjectId, id: ObjectId) -> Document { doc! { "_id": id, "userId": uid } }

#[instrument(skip_all)]
pub async fn list(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let uid = user_oid(&user)?;
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorApiTransaction>(COLL);
    let cursor = coll.find(doc! { "userId": uid }).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.find")))?;
    let mut rows: Vec<SabmonitorApiTransaction> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_one(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<SabmonitorApiTransaction>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    mongo.collection::<SabmonitorApiTransaction>(COLL).find_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.find_one")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("api_transaction".into()))
}

#[instrument(skip_all)]
pub async fn create(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateInput>) -> Result<Json<CreateResponse>> {
    let uid = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let mut entity = SabmonitorApiTransaction {
        id: None,
        user_id: uid,
        name: input.name,
        steps_json: input.steps_json,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorApiTransaction>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all)]
pub async fn update(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>, Json(patch): Json<UpdateInput>) -> Result<Json<SabmonitorApiTransaction>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name { set.insert("name", v); }
    if let Some(v) = patch.steps_json {
        if let Ok(b) = bson::to_bson(&v) { set.insert("stepsJson", b); }
    }
    let coll = mongo.collection::<SabmonitorApiTransaction>(COLL);
    let r = coll.update_one(ownership(uid, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.update")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("api_transaction".into())); }
    coll.find_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.refetch")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("api_transaction".into()))
}

#[instrument(skip_all)]
pub async fn delete(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<DeleteResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorApiTransaction>(COLL);
    let r = coll.delete_one(ownership(uid, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_api_transactions.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("api_transaction".into())); }
    Ok(Json(DeleteResponse { deleted: true }))
}
