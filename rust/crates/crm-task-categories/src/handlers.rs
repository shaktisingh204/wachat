//! HTTP handlers for the TaskCategory entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateTaskCategoryInput, CreateTaskCategoryResponse, DeleteTaskCategoryResponse, ListQuery,
    UpdateTaskCategoryInput,
};
use crate::types::CrmTaskCategory;

const COLL: &str = "crm_task_categories";
const ENTITY_KIND: &str = "task_category";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    parent_id: Option<&str>,
    is_active: Option<bool>,
) -> Document {
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
    if let Some(p) = parent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if p == "root" {
            filter.insert("parentId", Bson::Null);
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
        }
    }
    if let Some(a) = is_active {
        filter.insert("isActive", a);
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

fn parse_optional_parent(raw: Option<String>) -> Result<Option<Option<ObjectId>>> {
    match raw {
        None => Ok(None),
        Some(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                // Caller is explicitly clearing the parent.
                Ok(Some(None))
            } else {
                let oid = ObjectId::parse_str(trimmed).map_err(|_| {
                    ApiError::Validation("parentId is not a valid ObjectId".to_owned())
                })?;
                Ok(Some(Some(oid)))
            }
        }
    }
}

fn category_from_create(
    input: CreateTaskCategoryInput,
    user_id: ObjectId,
) -> Result<CrmTaskCategory> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent = parse_optional_parent(input.parent_id)?.unwrap_or(None);
    Ok(CrmTaskCategory {
        id: None,
        user_id,
        name: name.to_owned(),
        parent_id: parent,
        color: input.color,
        icon: input.icon,
        description: input.description,
        display_order: input.display_order.unwrap_or(0),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(self_id: ObjectId, patch: UpdateTaskCategoryInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name.clone().map(|s| s.trim().to_owned()) {
        if v.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        set.insert("name", v);
    }
    if let Some(maybe_parent) = parse_optional_parent(patch.parent_id)? {
        // Reject self-as-parent (cycle of length 1).
        if let Some(p) = maybe_parent
            && p == self_id
        {
            return Err(ApiError::Validation(
                "A category cannot be its own parent".to_owned(),
            ));
        }
        match maybe_parent {
            Some(oid) => set.insert("parentId", oid),
            None => set.insert("parentId", Bson::Null),
        };
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.display_order {
        set.insert("displayOrder", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmTaskCategory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTaskCategory>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_task_categories(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.parent_id.as_deref(),
        q.is_active,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "displayOrder": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmTaskCategory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.find"))
    })?;
    let mut rows: Vec<CrmTaskCategory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn get_task_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<CrmTaskCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;
    let coll = mongo.collection::<CrmTaskCategory>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("task_category".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_task_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaskCategoryInput>,
) -> Result<Json<CreateTaskCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = category_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTaskCategory>(COLL);

    // Unique-name guard among non-archived categories.
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "task category '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.insert"))
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

    Ok(Json(CreateTaskCategoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn update_task_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Json(patch): Json<UpdateTaskCategoryInput>,
) -> Result<Json<CrmTaskCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmTaskCategory>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("task_category".to_owned()))?;

    // Validate rename uniqueness.
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name != before.name {
            let dup = coll
                .find_one(duplicate_name_filter(user_id, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("crm_task_categories.dup_check"),
                    )
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "task category '{new_name}' already exists"
                )));
            }
        }
    }

    let update = build_update_doc(oid, patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_category".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("task_category".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn delete_task_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<DeleteTaskCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmTaskCategory>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_categories.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_category".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTaskCategoryResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn list_filter_root_finds_parentless_categories() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("root"), None);
        assert!(matches!(f.get("parentId"), Some(Bson::Null)));
    }

    #[test]
    fn category_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateTaskCategoryInput {
            name: "  Bug  ".into(),
            ..Default::default()
        };
        let c = category_from_create(input, user_id).unwrap();
        assert_eq!(c.name, "Bug");
        assert_eq!(c.status, "active");
        assert!(c.is_active);
        assert_eq!(c.display_order, 0);
        assert!(c.parent_id.is_none());
    }

    #[test]
    fn build_update_doc_rejects_self_as_parent() {
        let self_id = ObjectId::new();
        let patch = UpdateTaskCategoryInput {
            parent_id: Some(self_id.to_hex()),
            ..Default::default()
        };
        assert!(build_update_doc(self_id, patch).is_err());
    }

    #[test]
    fn build_update_doc_empty_parent_clears_to_null() {
        let self_id = ObjectId::new();
        let patch = UpdateTaskCategoryInput {
            parent_id: Some(String::new()),
            ..Default::default()
        };
        let d = build_update_doc(self_id, patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert!(matches!(set.get("parentId"), Some(Bson::Null)));
    }
}
