//! HTTP handlers for the Vendor Type master entity.

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
    CreateVendorTypeInput, CreateVendorTypeResponse, DeleteVendorTypeResponse, ListQuery,
    UpdateVendorTypeInput,
};
use crate::types::CrmVendorType;

const COLL: &str = "crm_vendor_types";
const ENTITY_KIND: &str = "vendor_type";

fn list_filter(user_id: ObjectId, status: Option<&str>, is_active: Option<bool>) -> Document {
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
    if let Some(b) = is_active {
        filter.insert("isActive", b);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn vendor_type_from_create(
    input: CreateVendorTypeInput,
    user_id: ObjectId,
) -> Result<CrmVendorType> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmVendorType {
        id: None,
        user_id,
        name,
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateVendorTypeInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(name) = patch.name {
        let trimmed = name.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(code) = patch.code {
        let trimmed = code.trim().to_owned();
        if trimmed.is_empty() {
            set.insert("code", bson::Bson::Null);
        } else {
            set.insert("code", trimmed);
        }
    }
    if let Some(desc) = patch.description {
        let trimmed = desc.trim().to_owned();
        if trimmed.is_empty() {
            set.insert("description", bson::Bson::Null);
        } else {
            set.insert("description", trimmed);
        }
    }
    if let Some(b) = patch.is_active {
        set.insert("isActive", b);
    }
    if let Some(s) = patch.status {
        set.insert("status", s);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmVendorType) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmVendorType>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_vendor_types(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_active);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "description"]);
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
    let coll = mongo.collection::<CrmVendorType>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.find"))
        })?;
    let mut rows: Vec<CrmVendorType> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vendor_type_id))]
pub async fn get_vendor_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_type_id): Path<String>,
) -> Result<Json<CrmVendorType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_type_id)?;
    let coll = mongo.collection::<CrmVendorType>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("vendor_type".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_vendor_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVendorTypeInput>,
) -> Result<Json<CreateVendorTypeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = vendor_type_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmVendorType>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.insert"))
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
    Ok(Json(CreateVendorTypeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vendor_type_id))]
pub async fn update_vendor_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_type_id): Path<String>,
    Json(patch): Json<UpdateVendorTypeInput>,
) -> Result<Json<CrmVendorType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_type_id)?;
    let coll = mongo.collection::<CrmVendorType>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("vendor_type".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("vendor_type".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.refetch")))?
        .ok_or_else(|| ApiError::NotFound("vendor_type".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vendor_type_id))]
pub async fn delete_vendor_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_type_id): Path<String>,
) -> Result<Json<DeleteVendorTypeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_type_id)?;
    let coll = mongo.collection::<CrmVendorType>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_types.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("vendor_type".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteVendorTypeResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("isActive"));
    }

    #[test]
    fn vendor_type_from_create_defaults_is_active_and_status() {
        let user_id = ObjectId::new();
        let input = CreateVendorTypeInput {
            name: "Supplier".into(),
            ..Default::default()
        };
        let vt = vendor_type_from_create(input, user_id).unwrap();
        assert_eq!(vt.name, "Supplier");
        assert!(vt.is_active);
        assert_eq!(vt.status, "active");
        assert!(vt.code.is_none());
    }

    #[test]
    fn vendor_type_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateVendorTypeInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(vendor_type_from_create(input, user_id).is_err());
    }
}
