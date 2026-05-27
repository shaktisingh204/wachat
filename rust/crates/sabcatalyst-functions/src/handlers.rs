//! Function-metadata HTTP handlers. The actual code ZIP is uploaded via
//! SabFiles on the TS side; this crate just stores `codeBlobFileId`
//! plus deploy/runtime metadata. The TS-side `IFunctionExecutor`
//! consumes the row and ships it to the real runtime (Mock for now).

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::FUNCTIONS_COLL;
use crate::dto::{
    CreateFunctionBody, ListFunctionsQuery, ListFunctionsResponse, MAX_LIMIT, MarkDeployedBody,
    UpdateFunctionBody,
};
use crate::state::SabcatalystFunctionsState;
use crate::types::{FunctionKind, FunctionRuntime, FunctionStatus};

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all, fields(user = %user.user_id))]
pub async fn list_functions(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Query(q): Query<ListFunctionsQuery>,
) -> Result<Json<ListFunctionsResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let mut filter = doc! { "userId": owner, "projectId": project };
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(cur) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(cur)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(limit).build();
    let coll = state.mongo.collection::<Document>(FUNCTIONS_COLL);
    let cur = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit { None } else {
        docs.last().and_then(|d| d.get_object_id("_id").ok()).map(|o| o.to_hex())
    };
    let items: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListFunctionsResponse { items, next_cursor }))
}

#[instrument(skip_all, fields(user = %user.user_id, fn_id = %id))]
pub async fn get_function(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let d = state.mongo.collection::<Document>(FUNCTIONS_COLL)
        .find_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Function not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all, fields(user = %user.user_id))]
pub async fn create_function(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Json(body): Json<CreateFunctionBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    if body.entrypoint.trim().is_empty() {
        return Err(ApiError::BadRequest("entrypoint required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let now = Utc::now();
    let kind = body.kind.unwrap_or(FunctionKind::Http);
    let runtime = body.runtime.unwrap_or(FunctionRuntime::Nodejs20);
    let kind_bson = to_bson(&kind).unwrap_or_else(|_| bson::Bson::String("http".into()));
    let runtime_bson = to_bson(&runtime).unwrap_or_else(|_| bson::Bson::String("nodejs20".into()));
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": owner,
        "projectId": project,
        "name": body.name.trim(),
        "kind": kind_bson,
        "runtime": runtime_bson,
        "entrypoint": body.entrypoint,
        "timeoutMs": body.timeout_ms.unwrap_or(15_000) as i64,
        "memoryMb": body.memory_mb.unwrap_or(256) as i64,
        "status": "active",
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    if let Some(c) = body.code_blob_file_id { d.insert("codeBlobFileId", c); }
    if let Some(e) = body.env_vars_json {
        if let Ok(b) = to_bson(&e) { d.insert("envVarsJson", b); }
    }
    if let Some(s) = body.schedule { d.insert("schedule", s); }
    state.mongo.collection::<Document>(FUNCTIONS_COLL).insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all, fields(user = %user.user_id, fn_id = %id))]
pub async fn update_function(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateFunctionBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = body.name { set.insert("name", v); }
    if let Some(v) = body.code_blob_file_id { set.insert("codeBlobFileId", v); }
    if let Some(v) = body.entrypoint { set.insert("entrypoint", v); }
    if let Some(v) = body.env_vars_json {
        if let Ok(b) = to_bson(&v) { set.insert("envVarsJson", b); }
    }
    if let Some(v) = body.timeout_ms { set.insert("timeoutMs", v as i64); }
    if let Some(v) = body.memory_mb { set.insert("memoryMb", v as i64); }
    if let Some(v) = body.schedule { set.insert("schedule", v); }
    if let Some(v) = body.status {
        let s = match v { FunctionStatus::Active => "active", FunctionStatus::Paused => "paused" };
        set.insert("status", s);
    }
    let d = state.mongo.collection::<Document>(FUNCTIONS_COLL)
        .find_one_and_update(doc! { "_id": oid, "userId": owner }, doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.update")))?
        .ok_or_else(|| ApiError::NotFound("Function not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all, fields(user = %user.user_id, fn_id = %id))]
pub async fn mark_deployed(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Path(id): Path<String>,
    Json(body): Json<MarkDeployedBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = Utc::now();
    let d = state.mongo.collection::<Document>(FUNCTIONS_COLL)
        .find_one_and_update(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": {
                "codeBlobFileId": body.code_blob_file_id,
                "lastDeployedAt": bson::DateTime::from_chrono(now),
                "updatedAt": bson::DateTime::from_chrono(now),
            } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.mark_deployed")))?
        .ok_or_else(|| ApiError::NotFound("Function not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all, fields(user = %user.user_id, fn_id = %id))]
pub async fn delete_function(
    user: AuthUser,
    State(state): State<SabcatalystFunctionsState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state.mongo.collection::<Document>(FUNCTIONS_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("functions.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("Function not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}
