//! HTTP handlers for SabWorkerly placements.

use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{pagination::{clamp_limit, skip_for}, tenant::user_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabworkerlyPlacement;

const COLL: &str = "sabworkerly_placements";

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyPlacement>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_placements(
    user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("active") {
        "all" => {}
        s @ ("active" | "completed" | "cancelled") => { filter.insert("status", s); }
        _ => {}
    }
    if let Some(s) = q.job_id.as_deref() {
        if !s.is_empty() { filter.insert("jobId", oid_from_str(s)?); }
    }
    if let Some(s) = q.worker_id.as_deref() {
        if !s.is_empty() { filter.insert("workerId", oid_from_str(s)?); }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startDate": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabworkerlyPlacement>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyPlacement> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_placement(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyPlacement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyPlacement>(COLL);
    let row = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("placement".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_placement(
    user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreatePlacementInput>,
) -> Result<Json<CreatePlacementResponse>> {
    let user_id = user_oid(&user)?;
    let job_oid = oid_from_str(&input.job_id)?;
    let worker_oid = oid_from_str(&input.worker_id)?;
    let mut p = SabworkerlyPlacement {
        id: None,
        user_id,
        job_id: job_oid,
        worker_id: worker_oid,
        start_date: BsonDateTime::from_chrono(input.start_date),
        end_date: input.end_date.map(BsonDateTime::from_chrono),
        hourly_charge_rate_minor: input.hourly_charge_rate_minor,
        hourly_pay_rate_minor: input.hourly_pay_rate_minor,
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyPlacement>(COLL);
    let inserted = coll.insert_one(&p).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    p.id = Some(new_id);
    Ok(Json(CreatePlacementResponse { id: new_id.to_hex(), entity: p }))
}

#[instrument(skip_all)]
pub async fn update_placement(
    user: AuthUser, State(mongo): State<MongoHandle>,
    Path(id): Path<String>, Json(patch): Json<UpdatePlacementInput>,
) -> Result<Json<SabworkerlyPlacement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.end_date { set.insert("endDate", BsonDateTime::from_chrono(v)); }
    if let Some(v) = patch.hourly_charge_rate_minor { set.insert("hourlyChargeRateMinor", v); }
    if let Some(v) = patch.hourly_pay_rate_minor { set.insert("hourlyPayRateMinor", v); }
    if let Some(v) = patch.status { set.insert("status", v); }
    let coll = mongo.collection::<SabworkerlyPlacement>(COLL);
    let result = coll.update_one(own(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("placement".to_owned())); }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("placement".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_placement(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<DeletePlacementResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyPlacement>(COLL);
    let result = coll.update_one(own(user_id, oid),
        doc! { "$set": { "status": "cancelled", "updatedAt": BsonDateTime::from_chrono(Utc::now()) } }
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("placement".to_owned())); }
    Ok(Json(DeletePlacementResponse { deleted: true }))
}
