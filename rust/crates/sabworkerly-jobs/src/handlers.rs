//! HTTP handlers for SabWorkerly jobs.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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

use crate::dto::*;
use crate::types::SabworkerlyJob;

const COLL: &str = "sabworkerly_jobs";

fn list_filter(user_id: ObjectId, status: Option<&str>, client: Option<ObjectId>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("open") {
        "all" => {}
        s @ ("open" | "filled" | "closed") => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "closed" });
        }
    }
    if let Some(c) = client {
        filter.insert("clientId", c);
    }
    filter
}

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyJob>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_jobs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let client = match q.client_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let mut filter = list_filter(user_id, q.status.as_deref(), client);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description", "shiftPattern"]);
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
    let coll = mongo.collection::<SabworkerlyJob>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyJob> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
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
pub async fn get_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabworkerlyJob>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyJob>(COLL);
    let row = coll
        .find_one(own(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("job".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateJobInput>,
) -> Result<Json<CreateJobResponse>> {
    let user_id = user_oid(&user)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let client_oid = oid_from_str(&input.client_id)?;
    let mut job = SabworkerlyJob {
        id: None,
        user_id,
        client_id: client_oid,
        title: input.title,
        description: input.description,
        skills_required: input.skills_required,
        shift_pattern: input.shift_pattern,
        hourly_charge_rate_minor: input.hourly_charge_rate_minor,
        hourly_pay_rate_minor: input.hourly_pay_rate_minor,
        currency: input.currency.unwrap_or_else(|| "USD".to_owned()),
        start_date: BsonDateTime::from_chrono(input.start_date),
        end_date: input.end_date.map(BsonDateTime::from_chrono),
        status: input.status.unwrap_or_else(|| "open".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyJob>(COLL);
    let inserted = coll
        .insert_one(&job)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    job.id = Some(new_id);
    Ok(Json(CreateJobResponse {
        id: new_id.to_hex(),
        entity: job,
    }))
}

#[instrument(skip_all)]
pub async fn update_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateJobInput>,
) -> Result<Json<SabworkerlyJob>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.client_id {
        set.insert("clientId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.skills_required {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("skillsRequired", arr);
    }
    if let Some(v) = patch.shift_pattern {
        set.insert("shiftPattern", v);
    }
    if let Some(v) = patch.hourly_charge_rate_minor {
        set.insert("hourlyChargeRateMinor", v);
    }
    if let Some(v) = patch.hourly_pay_rate_minor {
        set.insert("hourlyPayRateMinor", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.start_date {
        set.insert("startDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.end_date {
        set.insert("endDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let coll = mongo.collection::<SabworkerlyJob>(COLL);
    let result = coll
        .update_one(own(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("job".to_owned()));
    }
    let after = coll
        .find_one(own(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("job".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteJobResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyJob>(COLL);
    let result = coll.update_one(own(user_id, oid),
        doc! { "$set": { "status": "closed", "updatedAt": BsonDateTime::from_chrono(Utc::now()) } }
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("job".to_owned()));
    }
    Ok(Json(DeleteJobResponse { deleted: true }))
}
