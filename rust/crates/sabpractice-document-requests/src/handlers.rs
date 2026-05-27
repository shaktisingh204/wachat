//! HTTP handlers for the SabPractice Document Request entity.

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
    CreateDocRequestInput, CreateDocRequestResponse, DeleteDocRequestResponse, ListQuery,
    UpdateDocRequestInput,
};
use crate::types::SabPracticeDocumentRequest;

const COLL: &str = "sabpractice_document_requests";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    client_id: Option<ObjectId>,
    engagement_id: Option<ObjectId>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("open") {
        "all" => {}
        "approved" => {
            filter.insert("status", "approved");
        }
        "received" => {
            filter.insert("status", doc! { "$in": ["received", "reviewed"] });
        }
        _ => {
            filter.insert("status", doc! { "$ne": "approved" });
        }
    }
    if let Some(c) = client_id {
        filter.insert("clientId", c);
    }
    if let Some(e) = engagement_id {
        filter.insert("engagementId", e);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateDocRequestInput,
    user_id: ObjectId,
) -> Result<SabPracticeDocumentRequest> {
    let client_oid = oid_from_str(&input.client_id)?;
    let engagement_oid = match input.engagement_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabPracticeDocumentRequest {
        id: None,
        user_id,
        client_id: client_oid,
        engagement_id: engagement_oid,
        title: input.title,
        description: input.description,
        due_date: input.due_date.map(BsonDateTime::from_chrono),
        status: Some(input.status.unwrap_or_else(|| "requested".to_owned())),
        requested_files: input.requested_files,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDocRequestInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.client_id {
        set.insert("clientId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.engagement_id {
        if v.is_empty() {
            set.insert("engagementId", bson::Bson::Null);
        } else {
            set.insert("engagementId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.due_date {
        set.insert("dueDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.requested_files {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode requestedFiles"))
        })?;
        set.insert("requestedFiles", bson);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeDocumentRequest>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_doc_requests(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let client_oid = match q.client_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let engagement_oid = match q.engagement_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let mut filter = list_filter(user_id, q.status.as_deref(), client_oid, engagement_oid);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description"]);
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
    let coll = mongo.collection::<SabPracticeDocumentRequest>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.find")))?;
    let mut rows: Vec<SabPracticeDocumentRequest> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.collect")))?;
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
pub async fn get_doc_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeDocumentRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDocumentRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.find_one")))?
        .ok_or_else(|| ApiError::NotFound("document_request".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_doc_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDocRequestInput>,
) -> Result<Json<CreateDocRequestResponse>> {
    let user_id = user_oid(&user)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeDocumentRequest>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateDocRequestResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_doc_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateDocRequestInput>,
) -> Result<Json<SabPracticeDocumentRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDocumentRequest>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("document_request".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.refetch")))?
        .ok_or_else(|| ApiError::NotFound("document_request".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_doc_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteDocRequestResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDocumentRequest>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_document_requests.delete")))?;
    Ok(Json(DeleteDocRequestResponse {
        deleted: result.deleted_count > 0,
    }))
}
