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
use crate::types::SabmonitorStatusPageIncident;

const COLL: &str = "sabmonitor_status_page_incidents";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(user_id: ObjectId, id: ObjectId) -> Document { doc! { "_id": id, "userId": user_id } }

#[instrument(skip_all)]
pub async fn list(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status_page_id.as_deref() {
        filter.insert("statusPageId", oid_from_str(s)?);
    }
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "postedAt": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorStatusPageIncident>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.find")))?;
    let mut rows: Vec<SabmonitorStatusPageIncident> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_one(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<SabmonitorStatusPageIncident>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    mongo.collection::<SabmonitorStatusPageIncident>(COLL).find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.find_one")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("status_page_incident".into()))
}

#[instrument(skip_all)]
pub async fn create(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateInput>) -> Result<Json<CreateResponse>> {
    let user_id = user_oid(&user)?;
    let sp_oid = oid_from_str(&input.status_page_id)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".into()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabmonitorStatusPageIncident {
        id: None,
        user_id,
        status_page_id: sp_oid,
        title: input.title,
        kind: input.kind,
        posted_at: now,
        body: input.body,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorStatusPageIncident>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all)]
pub async fn update(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>, Json(patch): Json<UpdateInput>) -> Result<Json<SabmonitorStatusPageIncident>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.title { set.insert("title", v); }
    if let Some(v) = patch.kind { set.insert("kind", v); }
    if let Some(v) = patch.body { set.insert("body", v); }
    let coll = mongo.collection::<SabmonitorStatusPageIncident>(COLL);
    let r = coll.update_one(ownership(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.update")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("status_page_incident".into())); }
    coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.refetch")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("status_page_incident".into()))
}

#[instrument(skip_all)]
pub async fn delete(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorStatusPageIncident>(COLL);
    let r = coll.delete_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("status_page_incident".into())); }
    Ok(Json(DeleteResponse { deleted: true }))
}

/// Unauthenticated — returns recent posts for a given status page id.
#[instrument(skip_all, fields(status_page_id = %sp_id))]
pub async fn public_list_by_status_page(State(mongo): State<MongoHandle>, Path(sp_id): Path<String>) -> Result<Json<ListResponse>> {
    let sp_oid = oid_from_str(&sp_id)?;
    let opts = FindOptions::builder().sort(doc! { "postedAt": -1 }).limit(50).build();
    let coll = mongo.collection::<SabmonitorStatusPageIncident>(COLL);
    let cursor = coll.find(doc! { "statusPageId": sp_oid }).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.public_find")))?;
    let rows: Vec<SabmonitorStatusPageIncident> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_page_incidents.public_collect")))?;
    Ok(Json(ListResponse { items: rows, page: 0, limit: 50, has_more: false }))
}
