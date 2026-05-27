use axum::{Json, extract::{Path, Query, State}, http::StatusCode};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::TABLES_COLL;
use crate::dto::{CreateTableBody, ListTablesQuery, ListTablesResponse, MAX_LIMIT, UpdateTableBody};
use crate::state::SabcatalystTablesState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_tables(
    user: AuthUser, State(state): State<SabcatalystTablesState>, Query(q): Query<ListTablesQuery>,
) -> Result<Json<ListTablesResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let mut filter = doc! { "userId": owner, "projectId": project };
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(limit).build();
    let cur = state.mongo.collection::<Document>(TABLES_COLL).find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit { None } else {
        docs.last().and_then(|d| d.get_object_id("_id").ok()).map(|o| o.to_hex())
    };
    Ok(Json(ListTablesResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn get_table(
    user: AuthUser, State(state): State<SabcatalystTablesState>, Path(id): Path<String>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let d = state.mongo.collection::<Document>(TABLES_COLL)
        .find_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Table not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn create_table(
    user: AuthUser, State(state): State<SabcatalystTablesState>, Json(body): Json<CreateTableBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let now = Utc::now();
    let schema = to_bson(&body.schema_json)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("schema serialize")))?;
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project,
        "name": body.name.trim(),
        "schemaJson": schema,
        "recordsCount": 0_i64,
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    state.mongo.collection::<Document>(TABLES_COLL).insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn update_table(
    user: AuthUser, State(state): State<SabcatalystTablesState>, Path(id): Path<String>,
    Json(body): Json<UpdateTableBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = body.name { set.insert("name", v); }
    if let Some(v) = body.schema_json {
        if let Ok(b) = to_bson(&v) { set.insert("schemaJson", b); }
    }
    let d = state.mongo.collection::<Document>(TABLES_COLL)
        .find_one_and_update(doc! { "_id": oid, "userId": owner }, doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.update")))?
        .ok_or_else(|| ApiError::NotFound("Table not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn delete_table(
    user: AuthUser, State(state): State<SabcatalystTablesState>, Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state.mongo.collection::<Document>(TABLES_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tables.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("Table not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}
