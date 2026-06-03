//! HTTP handlers for the TaskLabel entity.

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
    CreateTaskLabelInput, CreateTaskLabelResponse, DeleteTaskLabelResponse, ListQuery,
    UpdateTaskLabelInput,
};
use crate::types::CrmTaskLabel;

const COLL: &str = "crm_task_labels";
const ENTITY_KIND: &str = "task_label";

fn list_filter(user_id: ObjectId, status: Option<&str>, is_active: Option<bool>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(active) = is_active {
        filter.insert("isActive", active);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Non-archived doc with the same name for this tenant — used for unique-name
/// enforcement on create and rename.
fn duplicate_name_filter(user_id: ObjectId, name: &str, exclude: Option<ObjectId>) -> Document {
    let mut filter = doc! {
        "userId": user_id,
        "name": name,
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    filter
}

fn label_from_create(input: CreateTaskLabelInput, user_id: ObjectId) -> Result<CrmTaskLabel> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let color = input.color.trim();
    if color.is_empty() {
        return Err(ApiError::Validation("color is required".to_owned()));
    }
    Ok(CrmTaskLabel {
        id: None,
        user_id,
        name: name.to_owned(),
        color: color.to_owned(),
        description: input.description,
        icon: input.icon,
        tasks_count: 0,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTaskLabelInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTaskLabel) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTaskLabel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_task_labels(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_active);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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

    let coll = mongo.collection::<CrmTaskLabel>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.find"))
        })?;
    let mut rows: Vec<CrmTaskLabel> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn get_task_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
) -> Result<Json<CrmTaskLabel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmTaskLabel>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.find_one")))?
        .ok_or_else(|| ApiError::NotFound("task_label".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_task_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaskLabelInput>,
) -> Result<Json<CreateTaskLabelResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = label_from_create(input, user_id)?;

    let coll = mongo.collection::<CrmTaskLabel>(COLL);

    // Unique-name guard (scoped to non-archived labels for this tenant).
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "task label '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTaskLabelResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn update_task_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
    Json(patch): Json<UpdateTaskLabelInput>,
) -> Result<Json<CrmTaskLabel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmTaskLabel>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.find_one")))?
        .ok_or_else(|| ApiError::NotFound("task_label".to_owned()))?;

    // Validate name (non-empty + unique among non-archived labels excluding self).
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name != before.name {
            let dup = coll
                .find_one(duplicate_name_filter(user_id, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.dup_check"))
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "task label '{new_name}' already exists"
                )));
            }
        }
    }

    // Validate color when present (must be non-empty if explicitly set).
    if let Some(new_color) = patch.color.as_deref().map(str::trim) {
        if new_color.is_empty() {
            return Err(ApiError::Validation("color must not be empty".to_owned()));
        }
    }

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_label".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.refetch")))?
        .ok_or_else(|| ApiError::NotFound("task_label".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn delete_task_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
) -> Result<Json<DeleteTaskLabelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmTaskLabel>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_labels.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_label".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTaskLabelResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn label_from_create_defaults_active_and_zero_count() {
        let user_id = ObjectId::new();
        let input = CreateTaskLabelInput {
            name: "  Urgent  ".into(),
            color: "#FF0000".into(),
            ..Default::default()
        };
        let l = label_from_create(input, user_id).unwrap();
        // Name + color are trimmed.
        assert_eq!(l.name, "Urgent");
        assert_eq!(l.color, "#FF0000");
        assert_eq!(l.status, "active");
        assert!(l.is_active);
        assert_eq!(l.tasks_count, 0);
    }

    #[test]
    fn label_from_create_rejects_empty_name_and_color() {
        let user_id = ObjectId::new();
        // Empty name.
        let input = CreateTaskLabelInput {
            name: "   ".into(),
            color: "#FF0000".into(),
            ..Default::default()
        };
        assert!(label_from_create(input, user_id).is_err());

        // Empty color.
        let input = CreateTaskLabelInput {
            name: "Urgent".into(),
            color: "   ".into(),
            ..Default::default()
        };
        assert!(label_from_create(input, user_id).is_err());
    }
}
