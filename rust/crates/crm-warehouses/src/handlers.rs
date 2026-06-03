//! HTTP handlers for the Warehouse inventory-tier entity.

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
    CreateWarehouseInput, CreateWarehouseResponse, DeleteWarehouseResponse, ListQuery,
    UpdateWarehouseInput,
};
use crate::types::CrmWarehouse;

const COLL: &str = "crm_warehouses";
const ENTITY_KIND: &str = "warehouse";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    kind: Option<&str>,
    city: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "inactive" => {
            filter.insert("status", "inactive");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(k) = kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", k);
    }
    if let Some(c) = city.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("city", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn from_create(input: CreateWarehouseInput, user_id: ObjectId) -> CrmWarehouse {
    let manager_id = input
        .manager_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    CrmWarehouse {
        id: None,
        user_id,
        name: input.name,
        code: input.code,
        kind: input.kind,
        status: input.status.or_else(|| Some("active".to_owned())),
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        pincode: input.pincode,
        phone: input.phone,
        manager_id,
        manager_name: input.manager_name,
        gstin: input.gstin,
        capacity_units: input.capacity_units,
        capacity_sqft: input.capacity_sqft,
        climate_controlled: input.climate_controlled,
        is_default: input.is_default,
        archived: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }
}

fn build_update_doc(patch: UpdateWarehouseInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.kind {
        set.insert("type", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.address {
        set.insert("address", v);
    }
    if let Some(v) = patch.city {
        set.insert("city", v);
    }
    if let Some(v) = patch.state {
        set.insert("state", v);
    }
    if let Some(v) = patch.country {
        set.insert("country", v);
    }
    if let Some(v) = patch.pincode {
        set.insert("pincode", v);
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.manager_id {
        if let Ok(oid) = ObjectId::parse_str(&v) {
            set.insert("managerId", oid);
        }
    }
    if let Some(v) = patch.manager_name {
        set.insert("managerName", v);
    }
    if let Some(v) = patch.gstin {
        set.insert("gstin", v);
    }
    if let Some(v) = patch.capacity_units {
        set.insert("capacityUnits", v);
    }
    if let Some(v) = patch.capacity_sqft {
        set.insert("capacitySqft", v);
    }
    if let Some(v) = patch.climate_controlled {
        set.insert("climateControlled", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.archived {
        set.insert("archived", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmWarehouse) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmWarehouse>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_warehouses(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.kind.as_deref(),
        q.city.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "city"]);
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

    let coll = mongo.collection::<CrmWarehouse>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.find"))
        })?;
    let mut rows: Vec<CrmWarehouse> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, warehouse_id = %warehouse_id))]
pub async fn get_warehouse(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(warehouse_id): Path<String>,
) -> Result<Json<CrmWarehouse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&warehouse_id)?;

    let coll = mongo.collection::<CrmWarehouse>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.find_one")))?
        .ok_or_else(|| ApiError::NotFound("warehouse".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_warehouse(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateWarehouseInput>,
) -> Result<Json<CreateWarehouseResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut entity = from_create(input, user_id);
    let coll = mongo.collection::<CrmWarehouse>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateWarehouseResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, warehouse_id = %warehouse_id))]
pub async fn update_warehouse(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(warehouse_id): Path<String>,
    Json(patch): Json<UpdateWarehouseInput>,
) -> Result<Json<CrmWarehouse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&warehouse_id)?;

    let coll = mongo.collection::<CrmWarehouse>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.find_one")))?
        .ok_or_else(|| ApiError::NotFound("warehouse".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("warehouse".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.refetch")))?
        .ok_or_else(|| ApiError::NotFound("warehouse".to_owned()))?;

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

/// Soft delete — flips `status: "archived"` + `archived: true`.
#[instrument(skip_all, fields(user_id = %user.user_id, warehouse_id = %warehouse_id))]
pub async fn delete_warehouse(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(warehouse_id): Path<String>,
) -> Result<Json<DeleteWarehouseResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&warehouse_id)?;

    let coll = mongo.collection::<CrmWarehouse>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "archived": true,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_warehouses.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("warehouse".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteWarehouseResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_with_kind_and_city() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("warehouse"), Some("Bangalore"));
        assert_eq!(f.get_str("type").unwrap(), "warehouse");
        assert_eq!(f.get_str("city").unwrap(), "Bangalore");
    }

    #[test]
    fn from_create_stamps_active_status_when_missing() {
        let user_id = ObjectId::new();
        let input = CreateWarehouseInput {
            name: "Main WH".into(),
            ..Default::default()
        };
        let w = from_create(input, user_id);
        assert_eq!(w.status.as_deref(), Some("active"));
        assert_eq!(w.user_id, user_id);
    }

    #[test]
    fn from_create_parses_manager_oid() {
        let user_id = ObjectId::new();
        let mgr = ObjectId::new();
        let input = CreateWarehouseInput {
            name: "WH".into(),
            manager_id: Some(mgr.to_hex()),
            ..Default::default()
        };
        let w = from_create(input, user_id);
        assert_eq!(w.manager_id, Some(mgr));
    }
}
