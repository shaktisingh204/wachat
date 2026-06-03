//! HTTP handlers for the SabPractice Advisory Note entity.

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
    CreateAdvisoryNoteInput, CreateAdvisoryNoteResponse, DeleteAdvisoryNoteResponse, ListQuery,
    UpdateAdvisoryNoteInput,
};
use crate::types::SabPracticeAdvisoryNote;

const COLL: &str = "sabpractice_advisory_notes";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateAdvisoryNoteInput,
    user_id: ObjectId,
) -> Result<SabPracticeAdvisoryNote> {
    let engagement_oid = match input.engagement_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabPracticeAdvisoryNote {
        id: None,
        user_id,
        client_id: oid_from_str(&input.client_id)?,
        engagement_id: engagement_oid,
        author_user_id: input.author_user_id,
        title: input.title,
        body: input.body,
        kind: Some(input.kind.unwrap_or_else(|| "insight".to_owned())),
        status: Some(input.status.unwrap_or_else(|| "draft".to_owned())),
        shared_at: None,
        tags: input.tags,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAdvisoryNoteInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.kind {
        set.insert("kind", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    if let Some(v) = patch.engagement_id {
        if v.is_empty() {
            set.insert("engagementId", bson::Bson::Null);
        } else {
            set.insert("engagementId", oid_from_str(&v)?);
        }
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeAdvisoryNote>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_advisory_notes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", s);
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(c) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(c)?);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "body"]);
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
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.find"))
    })?;
    let mut rows: Vec<SabPracticeAdvisoryNote> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.collect"))
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
pub async fn get_advisory_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeAdvisoryNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("advisory_note".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_advisory_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAdvisoryNoteInput>,
) -> Result<Json<CreateAdvisoryNoteResponse>> {
    let user_id = user_oid(&user)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAdvisoryNoteResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_advisory_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateAdvisoryNoteInput>,
) -> Result<Json<SabPracticeAdvisoryNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("advisory_note".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("advisory_note".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn share_advisory_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeAdvisoryNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "shared",
                "sharedAt": now,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.share"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("advisory_note".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("advisory_note".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_advisory_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteAdvisoryNoteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeAdvisoryNote>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_advisory_notes.delete"))
        })?;
    Ok(Json(DeleteAdvisoryNoteResponse {
        deleted: result.deleted_count > 0,
    }))
}
