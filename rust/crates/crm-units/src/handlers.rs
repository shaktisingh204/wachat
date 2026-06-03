//! HTTP handlers for the Unit-of-measure entity.

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
    CreateUnitInput, CreateUnitResponse, DeleteUnitResponse, ListQuery, UpdateUnitInput,
};
use crate::types::CrmUnit;

const COLL: &str = "crm_units";
const ENTITY_KIND: &str = "unit";

fn list_filter(user_id: ObjectId, status: Option<&str>, unit_type: Option<&str>) -> Document {
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
    if let Some(t) = unit_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("unitType", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn unit_from_create(input: CreateUnitInput, user_id: ObjectId) -> Result<CrmUnit> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let code = input.code.trim().to_owned();
    if code.is_empty() {
        return Err(ApiError::Validation("code is required".to_owned()));
    }
    Ok(CrmUnit {
        id: None,
        user_id,
        name,
        code,
        unit_type: input
            .unit_type
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        base_unit_id: input
            .base_unit_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        conversion_factor: input.conversion_factor,
        is_default: input.is_default.unwrap_or(false),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateUnitInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.code {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("code cannot be empty".to_owned()));
        }
        set.insert("code", trimmed);
    }
    if let Some(v) = patch.unit_type {
        set.insert("unitType", v);
    }
    if let Some(v) = patch
        .base_unit_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("baseUnitId", v);
    }
    if let Some(v) = patch.conversion_factor {
        set.insert("conversionFactor", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmUnit) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmUnit>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_units(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.unit_type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "unitType"]);
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
    let coll = mongo.collection::<CrmUnit>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.find")))?;
    let mut rows: Vec<CrmUnit> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %unit_id))]
pub async fn get_unit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(unit_id): Path<String>,
) -> Result<Json<CrmUnit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&unit_id)?;
    let coll = mongo.collection::<CrmUnit>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.find_one")))?
        .ok_or_else(|| ApiError::NotFound("unit".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_unit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateUnitInput>,
) -> Result<Json<CreateUnitResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = unit_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmUnit>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateUnitResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %unit_id))]
pub async fn update_unit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(unit_id): Path<String>,
    Json(patch): Json<UpdateUnitInput>,
) -> Result<Json<CrmUnit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&unit_id)?;
    let coll = mongo.collection::<CrmUnit>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.find_one")))?
        .ok_or_else(|| ApiError::NotFound("unit".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("unit".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.refetch")))?
        .ok_or_else(|| ApiError::NotFound("unit".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %unit_id))]
pub async fn delete_unit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(unit_id): Path<String>,
) -> Result<Json<DeleteUnitResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&unit_id)?;
    let coll = mongo.collection::<CrmUnit>(COLL);
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_units.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("unit".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteUnitResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn unit_from_create_defaults_active_and_status() {
        let user_id = ObjectId::new();
        let input = CreateUnitInput {
            name: "Kilogram".into(),
            code: "kg".into(),
            ..Default::default()
        };
        let u = unit_from_create(input, user_id).unwrap();
        assert_eq!(u.status, "active");
        assert!(u.is_active);
        assert!(!u.is_default);
        assert_eq!(u.code, "kg");
    }

    #[test]
    fn unit_from_create_rejects_empty_name_or_code() {
        let user_id = ObjectId::new();
        let no_name = CreateUnitInput {
            name: "   ".into(),
            code: "kg".into(),
            ..Default::default()
        };
        assert!(unit_from_create(no_name, user_id).is_err());
        let no_code = CreateUnitInput {
            name: "Kilogram".into(),
            code: "".into(),
            ..Default::default()
        };
        assert!(unit_from_create(no_code, user_id).is_err());
    }
}
