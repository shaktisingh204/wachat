//! HTTP handlers for the Brand foundational entity.

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
    CreateBrandInput, CreateBrandResponse, DeleteBrandResponse, ListQuery, UpdateBrandInput,
};
use crate::types::CrmBrand;

const COLL: &str = "crm_brands";
const ENTITY_KIND: &str = "brand";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
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
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn brand_from_create(input: CreateBrandInput, user_id: ObjectId) -> CrmBrand {
    CrmBrand {
        id: None,
        user_id,
        name: input.name,
        description: input.description,
        logo_url: input.logo_url,
        website: input.website,
        color: input.color,
        code: input.code,
        is_active: Some(input.is_active.unwrap_or(true)),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateBrandInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.logo_url {
        set.insert("logoUrl", v);
    }
    if let Some(v) = patch.website {
        set.insert("website", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmBrand) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmBrand>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_brands(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
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

    let coll = mongo.collection::<CrmBrand>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.find")))?;
    let mut rows: Vec<CrmBrand> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, brand_id = %brand_id))]
pub async fn get_brand(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(brand_id): Path<String>,
) -> Result<Json<CrmBrand>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&brand_id)?;

    let coll = mongo.collection::<CrmBrand>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.find_one")))?
        .ok_or_else(|| ApiError::NotFound("brand".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_brand(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBrandInput>,
) -> Result<Json<CreateBrandResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut entity = brand_from_create(input, user_id);
    let coll = mongo.collection::<CrmBrand>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateBrandResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, brand_id = %brand_id))]
pub async fn update_brand(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(brand_id): Path<String>,
    Json(patch): Json<UpdateBrandInput>,
) -> Result<Json<CrmBrand>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&brand_id)?;

    let coll = mongo.collection::<CrmBrand>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.find_one")))?
        .ok_or_else(|| ApiError::NotFound("brand".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("brand".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.refetch")))?
        .ok_or_else(|| ApiError::NotFound("brand".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, brand_id = %brand_id))]
pub async fn delete_brand(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(brand_id): Path<String>,
) -> Result<Json<DeleteBrandResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&brand_id)?;

    let coll = mongo.collection::<CrmBrand>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_brands.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("brand".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteBrandResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_defaults_to_active() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn build_update_doc_omits_unset_fields() {
        let patch = UpdateBrandInput {
            name: Some("Acme".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch);
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("name").unwrap(), "Acme");
        assert!(!set.contains_key("description"));
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn brand_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateBrandInput {
            name: "Acme".into(),
            ..Default::default()
        };
        let b = brand_from_create(input, user_id);
        assert_eq!(b.status.as_deref(), Some("active"));
        assert_eq!(b.user_id, user_id);
        assert!(b.id.is_none());
    }
}
