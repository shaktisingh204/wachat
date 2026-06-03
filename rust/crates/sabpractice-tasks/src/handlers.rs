//! HTTP handlers for the SabPractice Task entity.

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
    CreateTaskInput, CreateTaskResponse, DeleteTaskResponse, ListQuery, UpdateTaskInput,
};
use crate::types::SabPracticeTask;

const COLL: &str = "sabpractice_tasks";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    client_id: Option<ObjectId>,
    engagement_id: Option<ObjectId>,
    assignee_user_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("open") {
        "all" => {}
        "done" => {
            filter.insert("status", "done");
        }
        s if s != "open" => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "done" });
        }
    }
    if let Some(c) = client_id {
        filter.insert("clientId", c);
    }
    if let Some(e) = engagement_id {
        filter.insert("engagementId", e);
    }
    if let Some(uid) = assignee_user_id.filter(|s| !s.is_empty()) {
        filter.insert("assigneeUserId", uid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateTaskInput, user_id: ObjectId) -> Result<SabPracticeTask> {
    Ok(SabPracticeTask {
        id: None,
        user_id,
        client_id: oid_from_str(&input.client_id)?,
        engagement_id: oid_from_str(&input.engagement_id)?,
        title: input.title,
        description: input.description,
        assignee_user_id: input.assignee_user_id,
        due_date: input.due_date.map(BsonDateTime::from_chrono),
        status: Some(input.status.unwrap_or_else(|| "todo".to_owned())),
        priority: input.priority,
        billable: input.billable,
        hours_spent: input.hours_spent.unwrap_or(0.0),
        tags: input.tags,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTaskInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.client_id {
        set.insert("clientId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.engagement_id {
        set.insert("engagementId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.assignee_user_id {
        set.insert("assigneeUserId", v);
    }
    if let Some(v) = patch.due_date {
        set.insert("dueDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.billable {
        set.insert("billable", v);
    }
    if let Some(v) = patch.hours_spent {
        set.insert("hoursSpent", v);
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeTask>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tasks(
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
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        client_oid,
        engagement_oid,
        q.assignee_user_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "dueDate": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabPracticeTask>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.find"))
        })?;
    let mut rows: Vec<SabPracticeTask> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.collect"))
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
pub async fn get_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTask>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("task".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaskInput>,
) -> Result<Json<CreateTaskResponse>> {
    let user_id = user_oid(&user)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeTask>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTaskResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTaskInput>,
) -> Result<Json<SabPracticeTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTask>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("task".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTaskResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTask>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_tasks.delete"))
        })?;
    Ok(Json(DeleteTaskResponse {
        deleted: result.deleted_count > 0,
    }))
}
