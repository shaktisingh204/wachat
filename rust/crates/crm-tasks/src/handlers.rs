//! HTTP handlers for the Task entity.

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
    CreateTaskInput, CreateTaskResponse, DeleteTaskResponse, ListQuery, UpdateTaskInput,
};
use crate::types::CrmTask;

const COLL: &str = "crm_tasks";
const ENTITY_KIND: &str = "task";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    priority: Option<&str>,
    assigned_to: Option<&str>,
    linked_kind: Option<&str>,
    linked_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "To-Do" | "In Progress" | "Completed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(p) = priority.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("priority", p);
    }
    if let Some(a) = assigned_to.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("assignedTo", a);
    }
    if let Some(lk) = linked_kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("linkedKind", lk);
    }
    if let Some(li) = linked_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("linkedId", li);
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

fn task_from_create(input: CreateTaskInput, user_id: ObjectId) -> Result<CrmTask> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let assigned = input
        .assigned_to
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
        .unwrap_or(user_id);
    let reminders: Vec<BsonDateTime> = input
        .reminders
        .iter()
        .filter_map(|s| parse_date(s))
        .collect();
    Ok(CrmTask {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        description: input.description,
        r#type: Some(input.r#type.unwrap_or_else(|| "Follow-up".to_owned())),
        priority: Some(input.priority.unwrap_or_else(|| "Medium".to_owned())),
        status: Some(input.status.unwrap_or_else(|| "To-Do".to_owned())),
        due_date: input.due_date.as_deref().and_then(parse_date),
        reminders,
        recurring: None,
        checklist: input.checklist,
        attachments: input.attachments,
        assigned_to: Some(assigned),
        created_by: Some(user_id),
        linked_kind: input.linked_kind,
        linked_id: input
            .linked_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTaskInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.r#type {
        set.insert("type", v);
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
    if let Some(v) = patch.reminders {
        let arr: Vec<BsonDateTime> = v.iter().filter_map(|s| parse_date(s)).collect();
        set.insert("reminders", arr);
    }
    if let Some(v) = patch.checklist {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("checklist", arr);
    }
    if let Some(v) = patch.attachments {
        set.insert("attachments", v);
    }
    if let Some(v) = patch
        .assigned_to
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assignedTo", v);
    }
    if let Some(v) = patch.linked_kind {
        set.insert("linkedKind", v);
    }
    if let Some(v) = patch
        .linked_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("linkedId", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTask) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTask>,
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
        q.priority.as_deref(),
        q.assigned_to.as_deref(),
        q.linked_kind.as_deref(),
        q.linked_id.as_deref(),
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
    let coll = mongo.collection::<CrmTask>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.find")))?;
    let mut rows: Vec<CrmTask> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.collect")))?;
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
) -> Result<Json<CrmTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmTask>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.find_one")))?
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
    let mut entity = task_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTask>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTaskResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %task_id))]
pub async fn update_task(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(task_id): Path<String>,
    Json(patch): Json<UpdateTaskInput>,
) -> Result<Json<CrmTask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmTask>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.find_one")))?
        .ok_or_else(|| ApiError::NotFound("task".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.refetch")))?
        .ok_or_else(|| ApiError::NotFound("task".to_owned()))?;
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
) -> Result<Json<DeleteTaskResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&task_id)?;
    let coll = mongo.collection::<CrmTask>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tasks.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTaskResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn task_from_create_defaults_status_priority_assignee() {
        let user_id = ObjectId::new();
        let input = CreateTaskInput {
            title: "Call lead".into(),
            ..Default::default()
        };
        let t = task_from_create(input, user_id).unwrap();
        assert_eq!(t.status.as_deref(), Some("To-Do"));
        assert_eq!(t.priority.as_deref(), Some("Medium"));
        assert_eq!(t.r#type.as_deref(), Some("Follow-up"));
        assert_eq!(t.assigned_to, Some(user_id));
    }

    #[test]
    fn task_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateTaskInput {
            title: "".into(),
            ..Default::default()
        };
        assert!(task_from_create(input, user_id).is_err());
    }
}
