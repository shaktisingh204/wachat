//! HTTP handlers for the simplified Product entity.

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
    CreateProductInput, CreateProductResponse, DeleteProductResponse, ListQuery, UpdateProductInput,
};
use crate::types::CrmProduct;

const COLL: &str = "crm_products";
const ENTITY_KIND: &str = "product";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    brand: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "inactive" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            // Default: exclude soft-deleted (archived) products.
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(b) = brand.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("brand", b);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_sell_price(v: f64) -> Result<f64> {
    if !v.is_finite() || v < 0.0 {
        return Err(ApiError::Validation(
            "sellPrice must be a non-negative number".to_owned(),
        ));
    }
    Ok(v)
}

fn product_from_create(input: CreateProductInput, user_id: ObjectId) -> Result<CrmProduct> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let sell_price = validate_sell_price(input.sell_price.unwrap_or(0.0))?;
    let status = match input.status.as_deref() {
        Some("active") | Some("inactive") | Some("archived") => input.status.unwrap(),
        Some(_) | None => "active".to_owned(),
    };
    Ok(CrmProduct {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        sku: input
            .sku
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        category: input
            .category
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        brand: input
            .brand
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        unit: input
            .unit
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        buy_price: input.buy_price,
        sell_price,
        tax_rate: input.tax_rate,
        stock: input.stock,
        reorder_level: input.reorder_level,
        images: input.images.unwrap_or_default(),
        notes: input.notes,
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProductInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.sku {
        set.insert("sku", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.brand {
        set.insert("brand", v);
    }
    if let Some(v) = patch.unit {
        set.insert("unit", v);
    }
    if let Some(v) = patch.buy_price {
        set.insert("buyPrice", v);
    }
    if let Some(v) = patch.sell_price {
        let v = validate_sell_price(v)?;
        set.insert("sellPrice", v);
    }
    if let Some(v) = patch.tax_rate {
        set.insert("taxRate", v);
    }
    if let Some(v) = patch.stock {
        set.insert("stock", v);
    }
    if let Some(v) = patch.reorder_level {
        set.insert("reorderLevel", v);
    }
    if let Some(v) = patch.images {
        set.insert("images", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        match v.as_str() {
            "active" | "inactive" | "archived" => {
                set.insert("status", v);
            }
            _ => {
                return Err(ApiError::Validation(
                    "status must be one of: active, inactive, archived".to_owned(),
                ));
            }
        }
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmProduct) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProduct>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_products(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.brand.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "sku"]);
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
    let coll = mongo.collection::<CrmProduct>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find")))?;
    let mut rows: Vec<CrmProduct> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn get_product(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
) -> Result<Json<CrmProduct>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<CrmProduct>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find_one")))?
        .ok_or_else(|| ApiError::NotFound("product".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_product(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProductInput>,
) -> Result<Json<CreateProductResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = product_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProduct>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.insert")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn update_product(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
    Json(patch): Json<UpdateProductInput>,
) -> Result<Json<CrmProduct>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<CrmProduct>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find_one")))?
        .ok_or_else(|| ApiError::NotFound("product".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("product".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.refetch")))?
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn delete_product(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
) -> Result<Json<DeleteProductResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<CrmProduct>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("product".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProductResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        // Default branch: status must be filtered to "$ne: archived".
        assert!(f.contains_key("status"));
        let status = f.get("status").unwrap();
        assert!(
            status.as_document().is_some(),
            "default status filter should be a doc with $ne"
        );
    }

    #[test]
    fn product_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateProductInput {
            name: "   ".into(),
            sell_price: Some(10.0),
            ..Default::default()
        };
        assert!(product_from_create(input, user_id).is_err());
    }

    #[test]
    fn product_from_create_rejects_negative_sell_price() {
        let user_id = ObjectId::new();
        let input = CreateProductInput {
            name: "Widget".into(),
            sell_price: Some(-1.0),
            ..Default::default()
        };
        assert!(product_from_create(input, user_id).is_err());
    }
}
