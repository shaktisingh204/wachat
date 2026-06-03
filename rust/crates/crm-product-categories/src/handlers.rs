//! HTTP handlers for the Product Category foundational entity.

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
    CreateProductCategoryInput, CreateProductCategoryResponse, DeleteProductCategoryResponse,
    ListQuery, UpdateProductCategoryInput,
};
use crate::types::CrmProductCategory;

const COLL: &str = "crm_product_categories";
const ENTITY_KIND: &str = "product_category";

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

fn category_from_create(
    input: CreateProductCategoryInput,
    user_id: ObjectId,
) -> Result<CrmProductCategory> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmProductCategory {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        slug: input
            .slug
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned),
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        description: input.description,
        image_url: input.image_url,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProductCategoryInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(v) = patch
        .parent_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentId", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.image_url {
        set.insert("imageUrl", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmProductCategory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProductCategory>,
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
        let or = build_q_filter(needle, &["name", "slug", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmProductCategory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.find"))
    })?;
    let mut rows: Vec<CrmProductCategory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.collect"))
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
) -> Result<Json<CrmProductCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProductCategory>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("product_category".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProductCategoryInput>,
) -> Result<Json<CreateProductCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = category_from_create(input, user_id)?;

    let coll = mongo.collection::<CrmProductCategory>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.insert"))
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

    Ok(Json(CreateProductCategoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, category_id = %category_id))]
pub async fn update_category(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Json(patch): Json<UpdateProductCategoryInput>,
) -> Result<Json<CrmProductCategory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProductCategory>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("product_category".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("product_category".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("product_category".to_owned()))?;

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
) -> Result<Json<DeleteProductCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmProductCategory>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_product_categories.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("product_category".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteProductCategoryResponse { deleted: true }))
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
    }

    #[test]
    fn category_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateProductCategoryInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(category_from_create(input, user_id).is_err());
    }

    #[test]
    fn category_from_create_defaults_is_active_and_status() {
        let user_id = ObjectId::new();
        let input = CreateProductCategoryInput {
            name: "Beverages".into(),
            ..Default::default()
        };
        let c = category_from_create(input, user_id).unwrap();
        assert_eq!(c.name, "Beverages");
        assert!(c.is_active);
        assert_eq!(c.status, "active");
        assert!(c.id.is_none());
        assert_eq!(c.user_id, user_id);
    }
}
