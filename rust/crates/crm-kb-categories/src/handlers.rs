//! HTTP handlers for the KB Category entity.

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
    CreateCategoryInput, CreateCategoryResponse, DeleteCategoryResponse, ListQuery,
    UpdateCategoryInput,
};
use crate::types::CrmKbCategory;

const COLL: &str = "crm_kb_categories";
const ENTITY_KIND: &str = "kb_category";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    visibility: Option<&str>,
    parent_id: Option<&str>,
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
    if let Some(v) = visibility.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("visibility", v);
    }
    if let Some(p) = parent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if p == "root" {
            filter.insert("parentId", Bson::Null);
        } else if let Ok(oid) = oid_from_str(p) {
            filter.insert("parentId", oid);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn slugify(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut last_dash = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

fn category_from_create(
    input: CreateCategoryInput,
    user_id: ObjectId,
) -> Result<CrmKbCategory> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let slug = input
        .slug
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| slugify(&input.name));
    let parent_id = match input.parent_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) => Some(oid_from_str(p)?),
        None => None,
    };
    Ok(CrmKbCategory {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        slug,
        description: input.description,
        icon: input.icon,
        parent_id,
        order: input.order.unwrap_or(0),
        visibility: input.visibility.unwrap_or_else(|| "portal".to_owned()),
        article_count: 0,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCategoryInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(p) = patch.parent_id {
        let trimmed = p.trim();
        if trimmed.is_empty() || trimmed == "root" {
            set.insert("parentId", Bson::Null);
        } else {
            let oid = oid_from_str(trimmed)?;
            set.insert("parentId", oid);
        }
    }
    if let Some(v) = patch.order {
        set.insert("order", v);
    }
    if let Some(v) = patch.visibility {
        set.insert("visibility", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.article_count {
        set.insert("articleCount", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmKbCategory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmKbCategory>,
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
        q.visibility.as_deref(),
        q.parent_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "order": 1, "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmKbCategory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.find"))
    })?;
    let mut rows: Vec<CrmKbCategory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.collect"))
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
pub async fn get_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<CrmKbCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;
    let coll = mongo.collection::<CrmKbCategory>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("kb_category".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCategoryInput>,
) -> Result<Json<CreateCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = category_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmKbCategory>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateCategoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn update_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Json(patch): Json<UpdateCategoryInput>,
) -> Result<Json<CrmKbCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;
    let coll = mongo.collection::<CrmKbCategory>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("kb_category".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kb_category".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("kb_category".to_owned()))?;
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
pub async fn delete_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
) -> Result<Json<DeleteCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;
    let coll = mongo.collection::<CrmKbCategory>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_categories.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kb_category".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCategoryResponse { deleted: true }))
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
    fn list_filter_root_parent_uses_null() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, Some("root"));
        assert_eq!(f.get("parentId"), Some(&Bson::Null));
    }

    #[test]
    fn category_from_create_defaults_and_slug_generation() {
        let user_id = ObjectId::new();
        let input = CreateCategoryInput {
            name: "Billing & Refunds".into(),
            ..Default::default()
        };
        let c = category_from_create(input, user_id).unwrap();
        assert_eq!(c.status, "active");
        assert_eq!(c.visibility, "portal");
        assert_eq!(c.slug, "billing-refunds");
        assert!(c.parent_id.is_none());
    }

    #[test]
    fn category_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateCategoryInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(category_from_create(input, user_id).is_err());
    }
}
