//! HTTP handlers for the SabWorkerly Worker entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateWorkerInput, CreateWorkerResponse, DeleteWorkerResponse, ListQuery, UpdateWorkerInput,
};
use crate::types::SabworkerlyWorker;

const COLL: &str = "sabworkerly_workers";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        s @ ("active" | "inactive" | "on_assignment") => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "inactive" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn worker_from_create(input: CreateWorkerInput, user_id: ObjectId) -> Result<SabworkerlyWorker> {
    Ok(SabworkerlyWorker {
        id: None,
        user_id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        skills: input.skills,
        availability_json: input.availability_json,
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        hourly_rate_minor: input.hourly_rate_minor.unwrap_or(0),
        currency: input.currency.unwrap_or_else(|| "USD".to_owned()),
        address_json: input.address_json,
        document_ids: input.document_ids,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateWorkerInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name { set.insert("name", v); }
    if let Some(v) = patch.email { set.insert("email", v); }
    if let Some(v) = patch.phone { set.insert("phone", v); }
    if let Some(v) = patch.skills {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("skills", arr);
    }
    if let Some(v) = patch.availability_json {
        let b = to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        set.insert("availabilityJson", b);
    }
    if let Some(v) = patch.status { set.insert("status", v); }
    if let Some(v) = patch.hourly_rate_minor { set.insert("hourlyRateMinor", v); }
    if let Some(v) = patch.currency { set.insert("currency", v); }
    if let Some(v) = patch.address_json {
        let b = to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        set.insert("addressJson", b);
    }
    if let Some(v) = patch.document_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("documentIds", arr);
    }
    Ok(doc! { "$set": set })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_workers(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "email", "phone"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabworkerlyWorker>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyWorker> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyWorker>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_worker(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabworkerlyWorker>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyWorker>(COLL);
    let row = coll.find_one(ownership_filter(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("worker".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_worker(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateWorkerInput>,
) -> Result<Json<CreateWorkerResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.email.trim().is_empty() {
        return Err(ApiError::Validation("email is required".to_owned()));
    }
    let mut worker = worker_from_create(input, user_id)?;
    let coll = mongo.collection::<SabworkerlyWorker>(COLL);
    let inserted = coll.insert_one(&worker).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    worker.id = Some(new_id);
    Ok(Json(CreateWorkerResponse { id: new_id.to_hex(), entity: worker }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn update_worker(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateWorkerInput>,
) -> Result<Json<SabworkerlyWorker>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyWorker>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll.update_one(ownership_filter(user_id, oid), update).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("worker".to_owned()));
    }
    let after = coll.find_one(ownership_filter(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("worker".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn delete_worker(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteWorkerResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyWorker>(COLL);
    let result = coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "status": "inactive", "updatedAt": BsonDateTime::from_chrono(Utc::now()) } },
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("worker".to_owned()));
    }
    Ok(Json(DeleteWorkerResponse { deleted: true }))
}
