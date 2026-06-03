//! HTTP handlers for the Project Category foundational entity.

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
    CreateProjectCategoryInput, CreateProjectCategoryResponse, DeleteProjectCategoryResponse,
    ListQuery, UpdateProjectCategoryInput,
};
use crate::types::CrmProjectCategory;

const COLL: &str = "crm_project_categories";
const ENTITY_KIND: &str = "project_category";

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
        if p == "null" || p == "none" || p == "root" {
            filter.insert("parentId", doc! { "$in": [bson::Bson::Null] });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
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

fn parse_optional_oid(value: Option<&str>, field: &str) -> Result<Option<ObjectId>> {
    match value.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(s) => ObjectId::parse_str(s)
            .map(Some)
            .map_err(|_| ApiError::Validation(format!("{field} must be a valid ObjectId"))),
    }
}

/// Map a string patch field to either an ObjectId or explicit `null` for
/// clearing. Empty string also clears.
fn oid_or_unset(value: &str, field: &str) -> Result<Bson> {
    let s = value.trim();
    if s.is_empty() {
        return Ok(Bson::Null);
    }
    ObjectId::parse_str(s)
        .map(Bson::ObjectId)
        .map_err(|_| ApiError::Validation(format!("{field} must be a valid ObjectId")))
}

fn category_from_create(
    input: CreateProjectCategoryInput,
    user_id: ObjectId,
) -> Result<CrmProjectCategory> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent_id = parse_optional_oid(input.parent_id.as_deref(), "parentId")?;

    Ok(CrmProjectCategory {
        id: None,
        user_id,
        name: name.to_owned(),
        code: input
            .code
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned),
        color: input.color,
        icon: input.icon,
        description: input.description,
        parent_id,
        display_order: input.display_order.unwrap_or(0),
        is_active: input.is_active.unwrap_or(true),
        projects_count: 0,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProjectCategoryInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
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
    if let Some(v) = patch.parent_id {
        set.insert("parentId", oid_or_unset(&v, "parentId")?);
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

fn doc_for_audit(entity: &CrmProjectCategory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProjectCategory>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_categories(
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
        let or = build_q_filter(needle, &["name", "code", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "displayOrder": 1, "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmProjectCategory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.find"))
    })?;
    let mut rows: Vec<CrmProjectCategory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, category_id = %category_id))]
pub async fn get_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<CrmProjectCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProjectCategory>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_category".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProjectCategoryInput>,
) -> Result<Json<CreateProjectCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = category_from_create(input, user_id)?;

    let coll = mongo.collection::<CrmProjectCategory>(COLL);

    // Unique-name guard (scoped to non-archived categories for this tenant).
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "project category '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.insert"))
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

    Ok(Json(CreateProjectCategoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, category_id = %category_id))]
pub async fn update_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Json(patch): Json<UpdateProjectCategoryInput>,
) -> Result<Json<CrmProjectCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProjectCategory>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_category".to_owned()))?;

    // Validate name (non-empty + unique among non-archived excluding self).
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
                        anyhow::Error::new(e).context("crm_project_categories.dup_check"),
                    )
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "project category '{new_name}' already exists"
                )));
            }
        }
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("project_category".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("project_category".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, category_id = %category_id))]
pub async fn delete_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<DeleteProjectCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProjectCategory>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_project_categories.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("project_category".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteProjectCategoryResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_defaults_to_non_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("parentId"));
        assert!(!f.contains_key("isActive"));
    }

    #[test]
    fn category_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateProjectCategoryInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(category_from_create(input, user_id).is_err());
    }

    #[test]
    fn category_from_create_defaults_and_duplicate_filter_excludes_self() {
        let user_id = ObjectId::new();
        let input = CreateProjectCategoryInput {
            name: "Internal".into(),
            ..Default::default()
        };
        let c = category_from_create(input, user_id).unwrap();
        assert_eq!(c.name, "Internal");
        assert_eq!(c.display_order, 0);
        assert!(c.is_active);
        assert_eq!(c.projects_count, 0);
        assert_eq!(c.status, "active");
        assert!(c.id.is_none());
        assert_eq!(c.user_id, user_id);

        // duplicate filter scopes to tenant, excludes archived, and excludes self.
        let self_id = ObjectId::new();
        let f = duplicate_name_filter(user_id, "Internal", Some(self_id));
        assert_eq!(f.get_object_id("userId").ok(), Some(user_id));
        assert_eq!(f.get_str("name").ok(), Some("Internal"));
        assert!(f.contains_key("status"));
        assert!(f.contains_key("_id"));
    }
}
