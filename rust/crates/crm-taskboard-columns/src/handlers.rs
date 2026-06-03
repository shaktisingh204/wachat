//! HTTP handlers for the Taskboard Column entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateColumnInput, CreateColumnResponse, DeleteColumnResponse, ListQuery, UpdateColumnInput,
};
use crate::types::CrmTaskboardColumn;

const COLL: &str = "crm_taskboard_columns";
const ENTITY_KIND: &str = "taskboard_column";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    board_id: Option<&str>,
    project_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(bid) = board_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("boardId", bid);
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn column_from_create(input: CreateColumnInput, user_id: ObjectId) -> Result<CrmTaskboardColumn> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmTaskboardColumn {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        board_id: input
            .board_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        color: input.color,
        display_order: input.display_order.unwrap_or(0),
        wip_limit: input.wip_limit,
        default_status: input.default_status,
        is_collapsed: input.is_collapsed.unwrap_or(false),
        is_done_column: input.is_done_column.unwrap_or(false),
        tasks_count: 0,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateColumnInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch
        .board_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("boardId", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.display_order {
        set.insert("displayOrder", v);
    }
    if let Some(v) = patch.wip_limit {
        set.insert("wipLimit", v);
    }
    if let Some(v) = patch.default_status {
        set.insert("defaultStatus", v);
    }
    if let Some(v) = patch.is_collapsed {
        set.insert("isCollapsed", v);
    }
    if let Some(v) = patch.is_done_column {
        set.insert("isDoneColumn", v);
    }
    if let Some(v) = patch.tasks_count {
        set.insert("tasksCount", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTaskboardColumn) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTaskboardColumn>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_columns(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.board_id.as_deref(),
        q.project_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "defaultStatus"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "displayOrder": 1, "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmTaskboardColumn>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.find"))
    })?;
    let mut rows: Vec<CrmTaskboardColumn> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %column_id))]
pub async fn get_column(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(column_id): Path<String>,
) -> Result<Json<CrmTaskboardColumn>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&column_id)?;
    let coll = mongo.collection::<CrmTaskboardColumn>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("taskboard_column".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_column(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateColumnInput>,
) -> Result<Json<CreateColumnResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = column_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTaskboardColumn>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.insert"))
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
    Ok(Json(CreateColumnResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %column_id))]
pub async fn update_column(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(column_id): Path<String>,
    Json(patch): Json<UpdateColumnInput>,
) -> Result<Json<CrmTaskboardColumn>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&column_id)?;
    let coll = mongo.collection::<CrmTaskboardColumn>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("taskboard_column".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("taskboard_column".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("taskboard_column".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %column_id))]
pub async fn delete_column(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(column_id): Path<String>,
) -> Result<Json<DeleteColumnResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&column_id)?;
    let coll = mongo.collection::<CrmTaskboardColumn>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_taskboard_columns.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("taskboard_column".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteColumnResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("boardId"));
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn column_from_create_applies_defaults() {
        let user_id = ObjectId::new();
        let input = CreateColumnInput {
            name: "To Do".into(),
            ..Default::default()
        };
        let c = column_from_create(input, user_id).unwrap();
        assert_eq!(c.name, "To Do");
        assert_eq!(c.display_order, 0);
        assert!(c.is_active);
        assert!(!c.is_collapsed);
        assert!(!c.is_done_column);
        assert_eq!(c.tasks_count, 0);
        assert_eq!(c.status, "active");
    }

    #[test]
    fn column_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateColumnInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(column_from_create(input, user_id).is_err());
    }
}
