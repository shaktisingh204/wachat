//! HTTP handlers for the SabRewards Catalog entity.

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
    CreateCatalogItemInput, CreateCatalogItemResponse, DeleteCatalogItemResponse, ListQuery,
    UpdateCatalogItemInput,
};
use crate::types::RewardsCatalogItem;

const COLL: &str = "sabrewards_catalog";
const ENTITY_KIND: &str = "sabsabrewards_catalog_item";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn item_from_create(
    input: CreateCatalogItemInput,
    user_id: ObjectId,
) -> Result<RewardsCatalogItem> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.points_cost < 0 {
        return Err(ApiError::Validation(
            "pointsCost must be non-negative".to_owned(),
        ));
    }
    let program_id = match input.program_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(RewardsCatalogItem {
        id: None,
        user_id,
        program_id,
        name: input.name.trim().to_string(),
        description: input.description,
        image_file_id: input.image_file_id,
        points_cost: input.points_cost,
        stock: input.stock,
        active: input.active.unwrap_or(true),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCatalogItemInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.program_id {
        if v.is_empty() {
            set.insert("programId", bson::Bson::Null);
        } else {
            set.insert("programId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.image_file_id {
        set.insert("imageFileId", v);
    }
    if let Some(v) = patch.points_cost {
        if v < 0 {
            return Err(ApiError::Validation(
                "pointsCost must be non-negative".to_owned(),
            ));
        }
        set.insert("pointsCost", v);
    }
    if let Some(v) = patch.stock {
        set.insert("stock", v);
    }
    if let Some(v) = patch.active {
        set.insert("active", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &RewardsCatalogItem) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<RewardsCatalogItem>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_items(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = q.program_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("programId", oid_from_str(p)?);
    }
    if q.active_only.unwrap_or(false) {
        filter.insert("active", true);
    }
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

    let coll = mongo.collection::<RewardsCatalogItem>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.find"))
    })?;
    let mut rows: Vec<RewardsCatalogItem> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn get_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<RewardsCatalogItem>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<RewardsCatalogItem>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsabrewards_catalog_item".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCatalogItemInput>,
) -> Result<Json<CreateCatalogItemResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = item_from_create(input, user_id)?;
    let coll = mongo.collection::<RewardsCatalogItem>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.insert"))
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

    Ok(Json(CreateCatalogItemResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn update_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Json(patch): Json<UpdateCatalogItemInput>,
) -> Result<Json<RewardsCatalogItem>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;

    let coll = mongo.collection::<RewardsCatalogItem>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsabrewards_catalog_item".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabsabrewards_catalog_item".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsabrewards_catalog_item".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn delete_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<DeleteCatalogItemResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;

    let coll = mongo.collection::<RewardsCatalogItem>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_catalog.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sabsabrewards_catalog_item".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteCatalogItemResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_negative_cost() {
        let user = ObjectId::new();
        let input = CreateCatalogItemInput {
            name: "T-shirt".into(),
            points_cost: -5,
            ..Default::default()
        };
        assert!(item_from_create(input, user).is_err());
    }

    #[test]
    fn create_defaults_active_true() {
        let user = ObjectId::new();
        let input = CreateCatalogItemInput {
            name: "Mug".into(),
            points_cost: 100,
            ..Default::default()
        };
        let item = item_from_create(input, user).unwrap();
        assert!(item.active);
        assert_eq!(item.points_cost, 100);
    }

    #[test]
    fn create_persists_image_file_id() {
        let user = ObjectId::new();
        let input = CreateCatalogItemInput {
            name: "Hoodie".into(),
            points_cost: 500,
            image_file_id: Some("sabfile_abc".into()),
            ..Default::default()
        };
        let item = item_from_create(input, user).unwrap();
        assert_eq!(item.image_file_id.as_deref(), Some("sabfile_abc"));
    }
}
