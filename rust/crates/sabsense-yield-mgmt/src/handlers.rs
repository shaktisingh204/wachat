//! HTTP handlers for SabSense YieldMgmts.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateYieldMgmtInput, CreateYieldMgmtResponse, DeleteYieldMgmtResponse, ListQuery, UpdateYieldMgmtInput,
};
use crate::types::SabsenseYieldMgmt;

const COLL: &str = "sabsense_yield_mgmts";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status {
        Some("all") | None => {}
        Some(s) => {
            filter.insert("status", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn yield_mgmt_from_create(input: CreateYieldMgmtInput, user_id: ObjectId) -> Result<SabsenseYieldMgmt> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    
    Ok(SabsenseYieldMgmt {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateYieldMgmtInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsenseYieldMgmt>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_yield_mgmts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<SabsenseYieldMgmt>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.find")))?;
    let mut rows: Vec<SabsenseYieldMgmt> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, yield_mgmt_id = %yield_mgmt_id))]
pub async fn get_yield_mgmt(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(yield_mgmt_id): Path<String>,
) -> Result<Json<SabsenseYieldMgmt>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&yield_mgmt_id)?;
    let coll = mongo.collection::<SabsenseYieldMgmt>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_yield_mgmts".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_yield_mgmt(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateYieldMgmtInput>,
) -> Result<Json<CreateYieldMgmtResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = yield_mgmt_from_create(input, user_id)?;
    let coll = mongo.collection::<SabsenseYieldMgmt>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateYieldMgmtResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, yield_mgmt_id = %yield_mgmt_id))]
pub async fn update_yield_mgmt(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(yield_mgmt_id): Path<String>,
    Json(patch): Json<UpdateYieldMgmtInput>,
) -> Result<Json<SabsenseYieldMgmt>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&yield_mgmt_id)?;
    let coll = mongo.collection::<SabsenseYieldMgmt>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabsense_yield_mgmts".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_yield_mgmts".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, yield_mgmt_id = %yield_mgmt_id))]
pub async fn delete_yield_mgmt(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(yield_mgmt_id): Path<String>,
) -> Result<Json<DeleteYieldMgmtResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&yield_mgmt_id)?;
    let coll = mongo.collection::<SabsenseYieldMgmt>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_yield_mgmts.archive"))
        })?;
    Ok(Json(DeleteYieldMgmtResponse {
        deleted: result.matched_count > 0,
    }))
}
