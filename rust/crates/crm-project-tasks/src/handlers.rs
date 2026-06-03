//! HTTP handlers for the Project Task entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
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
    CreateProjectTaskInput, CreateProjectTaskResponse, DeleteProjectTaskResponse, ListQuery,
    UpdateProjectTaskInput,
};
use crate::types::CrmProjectTask;

const COLL: &str = "crm_project_tasks";
const ENTITY_KIND: &str = "project_task";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    project_id: Option<&str>,
    assignee_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "todo" | "in_progress" | "done" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    if let Some(aid) = assignee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("assigneeId", aid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn task_from_create(input: CreateProjectTaskInput, user_id: ObjectId) -> Result<CrmProjectTask> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmProjectTask {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        description: input.description,
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        assignee_id: input
            .assignee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        status: input.status.unwrap_or_else(|| "todo".to_owned()),
        due_date: input.due_date.as_deref().and_then(parse_date),
        progress: input.progress,
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProjectTaskInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch
        .assignee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assigneeId", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.due_date.as_deref().and_then(parse_date) {
        set.insert("dueDate", v);
    }
    if let Some(v) = patch.progress {
        set.insert("progress", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmProjectTask) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProjectTask>,
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
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.project_id.as_deref(),
        q.assignee_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description", "tags"]);
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
    let coll = mongo.collection::<CrmProjectTask>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.find"))
        })?;
    let mut rows: Vec<CrmProjectTask> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %task_id))]
pub async fn get_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(task_id): Path<String>,
) -> Result<Json<CrmProjectTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmProjectTask>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_task".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProjectTaskInput>,
) -> Result<Json<CreateProjectTaskResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = task_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProjectTask>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateProjectTaskResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %task_id))]
pub async fn update_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(task_id): Path<String>,
    Json(patch): Json<UpdateProjectTaskInput>,
) -> Result<Json<CrmProjectTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmProjectTask>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_task".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("project_task".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_task".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %task_id))]
pub async fn delete_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(task_id): Path<String>,
) -> Result<Json<DeleteProjectTaskResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmProjectTask>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_tasks.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("project_task".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProjectTaskResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn task_from_create_defaults_priority_and_status() {
        let user_id = ObjectId::new();
        let input = CreateProjectTaskInput {
            title: "Wire up auth".into(),
            ..Default::default()
        };
        let t = task_from_create(input, user_id).unwrap();
        assert_eq!(t.priority, "medium");
        assert_eq!(t.status, "todo");
        assert!(t.tags.is_empty());
    }

    #[test]
    fn task_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateProjectTaskInput {
            title: "   ".into(),
            ..Default::default()
        };
        assert!(task_from_create(input, user_id).is_err());
    }
}
