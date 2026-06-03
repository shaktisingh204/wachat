//! HTTP handlers for SabSense Biddings.

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
    CreateBiddingInput, CreateBiddingResponse, DeleteBiddingResponse, ListQuery, UpdateBiddingInput,
};
use crate::types::SabsenseBidding;

const COLL: &str = "sabsense_bidding";

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

fn bidding_from_create(input: CreateBiddingInput, user_id: ObjectId) -> Result<SabsenseBidding> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    
    Ok(SabsenseBidding {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateBiddingInput) -> Document {
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
    pub items: Vec<SabsenseBidding>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_biddings(
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
    let coll = mongo.collection::<SabsenseBidding>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.find")))?;
    let mut rows: Vec<SabsenseBidding> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, bidding_id = %bidding_id))]
pub async fn get_bidding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bidding_id): Path<String>,
) -> Result<Json<SabsenseBidding>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bidding_id)?;
    let coll = mongo.collection::<SabsenseBidding>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_bidding".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_bidding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBiddingInput>,
) -> Result<Json<CreateBiddingResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = bidding_from_create(input, user_id)?;
    let coll = mongo.collection::<SabsenseBidding>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateBiddingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, bidding_id = %bidding_id))]
pub async fn update_bidding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bidding_id): Path<String>,
    Json(patch): Json<UpdateBiddingInput>,
) -> Result<Json<SabsenseBidding>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bidding_id)?;
    let coll = mongo.collection::<SabsenseBidding>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabsense_bidding".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_bidding".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, bidding_id = %bidding_id))]
pub async fn delete_bidding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bidding_id): Path<String>,
) -> Result<Json<DeleteBiddingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bidding_id)?;
    let coll = mongo.collection::<SabsenseBidding>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_bidding.archive"))
        })?;
    Ok(Json(DeleteBiddingResponse {
        deleted: result.matched_count > 0,
    }))
}
