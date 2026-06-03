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
    CreateProductInput, CreateProductResponse, DeleteProductResponse, ListQuery, UpdateProductInput,
};
use crate::types::SabshopProduct;

const COLL: &str = "sabshop_products";
const ENTITY_KIND: &str = "sabshop_product";

fn ownership_filter(user_id: ObjectId, doc_id: ObjectId) -> Document {
    doc! { "_id": doc_id, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut f = doc! { "userId": user_id };
    if let Some(s) = status {
        f.insert("status", s);
    }
    f
}

fn ids_to_bson(strs: Vec<String>) -> Bson {
    let arr = strs
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok())
        .map(Bson::ObjectId)
        .collect::<Vec<_>>();
    Bson::Array(arr)
}

fn entity_from_create(input: CreateProductInput, user_id: ObjectId) -> Result<SabshopProduct> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title cannot be empty".to_owned()));
    }

    let now = BsonDateTime::from_chrono(Utc::now());

    let mut collection_ids = vec![];
    if let Some(ids) = input.collection_ids {
        for s in ids {
            if let Ok(id) = ObjectId::parse_str(&s) {
                collection_ids.push(id);
            }
        }
    }

    Ok(SabshopProduct {
        id: None,
        user_id,
        tenant_id: None,
        title: input.title.trim().to_owned(),
        slug: input.slug.trim().to_lowercase(),
        description: input.description,
        html_description: input.html_description,
        media_urls: input.media_urls.unwrap_or_default(),
        vendor: input.vendor,
        product_type: input.product_type,
        tags: input.tags.unwrap_or_default(),
        status: "draft".to_owned(),
        collection_ids,
        options: input.options.unwrap_or_default(),
        variants: input.variants.unwrap_or_default(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProductInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v.trim());
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v.trim().to_lowercase());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.html_description {
        set.insert("htmlDescription", v);
    }
    if let Some(v) = patch.media_urls {
        let b = v.into_iter().map(Bson::String).collect::<Vec<_>>();
        set.insert("mediaUrls", b);
    }
    if let Some(v) = patch.vendor {
        set.insert("vendor", v);
    }
    if let Some(v) = patch.product_type {
        set.insert("productType", v);
    }
    if let Some(v) = patch.tags {
        let b = v.into_iter().map(Bson::String).collect::<Vec<_>>();
        set.insert("tags", b);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.collection_ids {
        set.insert("collectionIds", ids_to_bson(v));
    }
    if let Some(v) = patch.options {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("options", b);
        }
    }
    if let Some(v) = patch.variants {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("variants", b);
        }
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabshopProduct) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopProduct>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "slug", "vendor", "productType"]);
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

    let coll = mongo.collection::<SabshopProduct>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.find"))
        })?;
    let mut rows: Vec<SabshopProduct> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, product_id = %product_id))]
pub async fn get(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
) -> Result<Json<SabshopProduct>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<SabshopProduct>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("product".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProductInput>,
) -> Result<Json<CreateProductResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabshopProduct>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.insert"))
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
    Ok(Json(CreateProductResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, product_id = %product_id))]
pub async fn update(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
    Json(patch): Json<UpdateProductInput>,
) -> Result<Json<SabshopProduct>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<SabshopProduct>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("product".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("product".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.refetch")))?
        .ok_or_else(|| ApiError::NotFound("product".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, product_id = %product_id))]
pub async fn delete(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
) -> Result<Json<DeleteProductResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<SabshopProduct>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_products.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("product".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProductResponse { deleted: true }))
}
