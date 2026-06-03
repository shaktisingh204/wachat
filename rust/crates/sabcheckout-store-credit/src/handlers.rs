//! HTTP handlers for SabCheckout StoreCredits.

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
    CreateStoreCreditInput, CreateStoreCreditResponse, DeleteStoreCreditResponse, ListQuery,
    UpdateStoreCreditInput,
};
use crate::types::SabcheckoutStoreCredit;

const COLL: &str = "sabcheckout_store_credit";

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

fn store_credit_from_create(
    input: CreateStoreCreditInput,
    user_id: ObjectId,
) -> Result<SabcheckoutStoreCredit> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    Ok(SabcheckoutStoreCredit {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateStoreCreditInput) -> Document {
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
    pub items: Vec<SabcheckoutStoreCredit>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_store_credits(
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
    let coll = mongo.collection::<SabcheckoutStoreCredit>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.find"))
    })?;
    let mut rows: Vec<SabcheckoutStoreCredit> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, store_credit_id = %store_credit_id))]
pub async fn get_store_credit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(store_credit_id): Path<String>,
) -> Result<Json<SabcheckoutStoreCredit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&store_credit_id)?;
    let coll = mongo.collection::<SabcheckoutStoreCredit>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_store_credit".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_store_credit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStoreCreditInput>,
) -> Result<Json<CreateStoreCreditResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = store_credit_from_create(input, user_id)?;
    let coll = mongo.collection::<SabcheckoutStoreCredit>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateStoreCreditResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, store_credit_id = %store_credit_id))]
pub async fn update_store_credit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(store_credit_id): Path<String>,
    Json(patch): Json<UpdateStoreCreditInput>,
) -> Result<Json<SabcheckoutStoreCredit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&store_credit_id)?;
    let coll = mongo.collection::<SabcheckoutStoreCredit>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_store_credit".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_store_credit".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, store_credit_id = %store_credit_id))]
pub async fn delete_store_credit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(store_credit_id): Path<String>,
) -> Result<Json<DeleteStoreCreditResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&store_credit_id)?;
    let coll = mongo.collection::<SabcheckoutStoreCredit>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_store_credit.archive"))
        })?;
    Ok(Json(DeleteStoreCreditResponse {
        deleted: result.matched_count > 0,
    }))
}
