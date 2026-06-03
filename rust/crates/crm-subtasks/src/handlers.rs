//! HTTP handlers for the Subtask entity.

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
    CreateSubtaskInput, CreateSubtaskResponse, DeleteSubtaskResponse, ListQuery, UpdateSubtaskInput,
};
use crate::types::CrmSubtask;

const COLL: &str = "crm_subtasks";
const ENTITY_KIND: &str = "subtask";

fn is_valid_parent_kind(s: &str) -> bool {
    matches!(s, "task" | "project_task")
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    parent_id: Option<&str>,
    parent_kind: Option<&str>,
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
    if let Some(pid) = parent_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("parentId", pid);
    }
    if let Some(pk) = parent_kind
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| is_valid_parent_kind(s))
    {
        filter.insert("parentKind", pk);
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

fn subtask_from_create(input: CreateSubtaskInput, user_id: ObjectId) -> Result<CrmSubtask> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let parent_id = ObjectId::parse_str(input.parent_id.trim())
        .map_err(|_| ApiError::Validation("parentId must be a valid ObjectId".to_owned()))?;
    let parent_kind = input
        .parent_kind
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("task")
        .to_owned();
    if !is_valid_parent_kind(&parent_kind) {
        return Err(ApiError::Validation(
            "parentKind must be 'task' or 'project_task'".to_owned(),
        ));
    }
    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("todo")
        .to_owned();
    let completed_at = if status == "done" {
        Some(BsonDateTime::from_chrono(Utc::now()))
    } else {
        None
    };
    Ok(CrmSubtask {
        id: None,
        user_id,
        parent_id,
        parent_kind,
        title: title.to_owned(),
        description: input.description,
        assignee_id: input
            .assignee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        due_date: input.due_date.as_deref().and_then(parse_date),
        order: input.order,
        status,
        completed_at,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

/// Build a `$set` update document from a patch. When status transitions to
/// `"done"`, stamp `completedAt`. When status moves away from `"done"`, clear
/// it via `$unset`.
fn build_update_doc(patch: UpdateSubtaskInput, before_status: &str) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let mut unset = Document::new();
    if let Some(v) = patch
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch
        .assignee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assigneeId", v);
    }
    if let Some(v) = patch.due_date.as_deref().and_then(parse_date) {
        set.insert("dueDate", v);
    }
    if let Some(v) = patch.order {
        set.insert("order", v);
    }
    if let Some(v) = patch.status {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            set.insert("status", trimmed);
            if trimmed == "done" && before_status != "done" {
                set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
            } else if trimmed != "done" && before_status == "done" {
                unset.insert("completedAt", "");
            }
        }
    }
    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }
    update
}

fn doc_for_audit(entity: &CrmSubtask) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSubtask>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_subtasks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.parent_id.as_deref(),
        q.parent_kind.as_deref(),
        q.assignee_id.as_deref(),
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
        .sort(doc! { "order": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmSubtask>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.find")))?;
    let mut rows: Vec<CrmSubtask> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %subtask_id))]
pub async fn get_subtask(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subtask_id): Path<String>,
) -> Result<Json<CrmSubtask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subtask_id)?;
    let coll = mongo.collection::<CrmSubtask>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.find_one")))?
        .ok_or_else(|| ApiError::NotFound("subtask".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_subtask(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSubtaskInput>,
) -> Result<Json<CreateSubtaskResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = subtask_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSubtask>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSubtaskResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %subtask_id))]
pub async fn update_subtask(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subtask_id): Path<String>,
    Json(patch): Json<UpdateSubtaskInput>,
) -> Result<Json<CrmSubtask>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subtask_id)?;
    let coll = mongo.collection::<CrmSubtask>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.find_one")))?
        .ok_or_else(|| ApiError::NotFound("subtask".to_owned()))?;
    let update = build_update_doc(patch, &before.status);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("subtask".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.refetch")))?
        .ok_or_else(|| ApiError::NotFound("subtask".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %subtask_id))]
pub async fn delete_subtask(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subtask_id): Path<String>,
) -> Result<Json<DeleteSubtaskResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subtask_id)?;
    let coll = mongo.collection::<CrmSubtask>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_subtasks.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("subtask".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSubtaskResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parent_oid_hex() -> String {
        ObjectId::new().to_hex()
    }

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        assert!(f.contains_key("status"));
        // Default = $ne archived, not equality.
        let s = f.get_document("status").unwrap();
        assert_eq!(s.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn subtask_from_create_defaults_status_and_parent_kind() {
        let user_id = ObjectId::new();
        let input = CreateSubtaskInput {
            parent_id: parent_oid_hex(),
            title: "Write docs".into(),
            ..Default::default()
        };
        let s = subtask_from_create(input, user_id).unwrap();
        assert_eq!(s.parent_kind, "task");
        assert_eq!(s.status, "todo");
        assert!(s.completed_at.is_none());
    }

    #[test]
    fn subtask_from_create_rejects_empty_title_and_bad_parent_id() {
        let user_id = ObjectId::new();
        let bad_title = CreateSubtaskInput {
            parent_id: parent_oid_hex(),
            title: "   ".into(),
            ..Default::default()
        };
        assert!(subtask_from_create(bad_title, user_id).is_err());

        let bad_parent = CreateSubtaskInput {
            parent_id: "not-an-oid".into(),
            title: "Something".into(),
            ..Default::default()
        };
        assert!(subtask_from_create(bad_parent, user_id).is_err());
    }
}
