//! HTTP handlers for the SabPractice Deadline entity.

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
    CreateDeadlineInput, CreateDeadlineResponse, DeleteDeadlineResponse, FileDeadlineInput,
    ListQuery, UpdateDeadlineInput,
};
use crate::types::SabPracticeDeadline;

const COLL: &str = "sabpractice_deadlines";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateDeadlineInput, user_id: ObjectId) -> Result<SabPracticeDeadline> {
    let engagement_oid = match input.engagement_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabPracticeDeadline {
        id: None,
        user_id,
        client_id: oid_from_str(&input.client_id)?,
        engagement_id: engagement_oid,
        name: input.name,
        kind: Some(input.kind.unwrap_or_else(|| "custom".to_owned())),
        due_date: BsonDateTime::from_chrono(input.due_date),
        recurrence: input.recurrence,
        status: Some(input.status.unwrap_or_else(|| "upcoming".to_owned())),
        assigned_user_id: input.assigned_user_id,
        notes: input.notes,
        completed_at: None,
        attachment_file_ids: input.attachment_file_ids,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDeadlineInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.kind {
        set.insert("kind", v);
    }
    if let Some(v) = patch.due_date {
        set.insert("dueDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.recurrence {
        set.insert("recurrence", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.assigned_user_id {
        set.insert("assignedUserId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.attachment_file_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("attachmentFileIds", arr);
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
    pub items: Vec<SabPracticeDeadline>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_deadlines(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("open") {
        "all" => {}
        "filed" => {
            filter.insert("status", "filed");
        }
        s if s != "open" => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "filed" });
        }
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(c) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(c)?);
    }
    match (q.from, q.to) {
        (Some(f), Some(t)) => {
            filter.insert(
                "dueDate",
                doc! {
                    "$gte": BsonDateTime::from_chrono(f),
                    "$lte": BsonDateTime::from_chrono(t),
                },
            );
        }
        (Some(f), None) => {
            filter.insert("dueDate", doc! { "$gte": BsonDateTime::from_chrono(f) });
        }
        (None, Some(t)) => {
            filter.insert("dueDate", doc! { "$lte": BsonDateTime::from_chrono(t) });
        }
        _ => {}
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "dueDate": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.find")))?;
    let mut rows: Vec<SabPracticeDeadline> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.collect")))?;
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
pub async fn get_deadline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeDeadline>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.find_one")))?
        .ok_or_else(|| ApiError::NotFound("deadline".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_deadline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDeadlineInput>,
) -> Result<Json<CreateDeadlineResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateDeadlineResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_deadline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateDeadlineInput>,
) -> Result<Json<SabPracticeDeadline>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("deadline".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.refetch")))?
        .ok_or_else(|| ApiError::NotFound("deadline".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn file_deadline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<FileDeadlineInput>,
) -> Result<Json<SabPracticeDeadline>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": "filed",
        "completedAt": now,
        "updatedAt": now,
    };
    if !input.attachment_file_ids.is_empty() {
        let arr: Vec<Bson> = input.attachment_file_ids.into_iter().map(Bson::String).collect();
        set.insert("attachmentFileIds", arr);
    }
    if let Some(n) = input.notes {
        set.insert("notes", n);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.file")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("deadline".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.refetch")))?
        .ok_or_else(|| ApiError::NotFound("deadline".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_deadline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteDeadlineResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeDeadline>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_deadlines.delete")))?;
    Ok(Json(DeleteDeadlineResponse {
        deleted: result.deleted_count > 0,
    }))
}
