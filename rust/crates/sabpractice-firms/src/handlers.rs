//! HTTP handlers for the SabPractice Firm entity.

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

use crate::dto::{
    CreateFirmInput, CreateFirmResponse, DeleteFirmResponse, ListQuery, UpdateFirmInput,
};
use crate::types::SabPracticeFirm;

const FIRMS_COLL: &str = "sabpractice_firms";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "inactive" => {
            filter.insert("status", "inactive");
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

fn firm_from_create(input: CreateFirmInput, user_id: ObjectId) -> SabPracticeFirm {
    SabPracticeFirm {
        id: None,
        user_id,
        name: input.name,
        registration_no: input.registration_no,
        email: input.email,
        phone: input.phone,
        website: input.website,
        address: input.address,
        timezone: input.timezone,
        currency: input.currency,
        fiscal_year_start_month: input.fiscal_year_start_month,
        services: input.services,
        status: Some(input.status.unwrap_or_else(|| "active".to_owned())),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }
}

fn build_update_doc(patch: UpdateFirmInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.registration_no {
        set.insert("registrationNo", v);
    }
    if let Some(v) = patch.email {
        set.insert("email", v);
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.website {
        set.insert("website", v);
    }
    if let Some(v) = patch.address {
        set.insert("address", v);
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.fiscal_year_start_month {
        set.insert("fiscalYearStartMonth", v as i32);
    }
    if let Some(v) = patch.services {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("services", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeFirm>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_firms(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "registrationNo", "email"]);
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
    let coll = mongo.collection::<SabPracticeFirm>(FIRMS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.find"))
        })?;
    let mut rows: Vec<SabPracticeFirm> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, firm_id = %id))]
pub async fn get_firm(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeFirm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeFirm>(FIRMS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("firm".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_firm(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFirmInput>,
) -> Result<Json<CreateFirmResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut firm = firm_from_create(input, user_id);
    let coll = mongo.collection::<SabPracticeFirm>(FIRMS_COLL);
    let inserted = coll.insert_one(&firm).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    firm.id = Some(new_id);
    Ok(Json(CreateFirmResponse {
        id: new_id.to_hex(),
        entity: firm,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, firm_id = %id))]
pub async fn update_firm(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateFirmInput>,
) -> Result<Json<SabPracticeFirm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeFirm>(FIRMS_COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("firm".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("firm".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, firm_id = %id))]
pub async fn delete_firm(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteFirmResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeFirm>(FIRMS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "inactive",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_firms.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("firm".to_owned()));
    }
    Ok(Json(DeleteFirmResponse { deleted: true }))
}
