//! HTTP handlers for sabsense-consent-mgmt.

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
    CreateItemInput, CreateItemResponse, DeleteItemResponse, ListQuery, UpdateItemInput,
};
use crate::types::ConsentRecord;

const COLL: &str = "sabsense_consent_records";

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

fn entity_from_create(input: CreateItemInput, user_id: ObjectId) -> Result<ConsentRecord> {
    Ok(ConsentRecord {
        id: None,
        user_id,
        consent_given: input.consent_given.unwrap_or(false),
        policy_version: input.policy_version,
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateItemInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.consent_given {
            set.insert("consentGiven", v);
        }
        if let Some(v) = patch.policy_version {
            set.insert("policyVersion", v);
        }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<ConsentRecord>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_items(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<ConsentRecord>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.find")))?;
    let mut rows: Vec<ConsentRecord> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<ConsentRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<ConsentRecord>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_consent_records".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateItemInput>,
) -> Result<Json<CreateItemResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<ConsentRecord>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateItemResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateItemInput>,
) -> Result<Json<ConsentRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<ConsentRecord>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabsense_consent_records".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_consent_records".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteItemResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<ConsentRecord>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_consent_records.archive"))
        })?;
    Ok(Json(DeleteItemResponse {
        deleted: result.matched_count > 0,
    }))
}
