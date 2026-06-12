//! HTTP handlers for the Item/Product entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log` with
//! `entityKind == "item"`.

use axum::{
    Extension, Json,
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
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateItemInput, CreateItemResponse, DeleteItemResponse, ListQuery, ScopeQuery,
    UpdateItemInput,
};
use crate::types::{CrmProduct, ProductDimensions, ProductWeight};

const ITEMS_COLL: &str = "crm_products";
const ENTITY_KIND: &str = "item";

// ─── Filter helpers ──────────────────────────────────────────────────────

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId`.
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

/// Base tenant filter. `crm_products` has no `archived` / `status` field on
/// the TS side, so list is a flat tenant filter — search is the only further
/// narrowing.
fn list_filter(scope: &TenantScope) -> Document {
    scope.filter()
}

/// Tenant-scoped filter for get / update / delete by id.
fn ownership_filter(scope: &TenantScope, item_oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", item_oid);
    filter
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn parse_optional_oid(raw: Option<String>) -> std::result::Result<Option<ObjectId>, ApiError> {
    match raw.as_deref().map(str::trim) {
        Some(s) if !s.is_empty() => Ok(Some(oid_from_str(s)?)),
        _ => Ok(None),
    }
}

fn item_from_create(
    input: CreateItemInput,
    user_id: ObjectId,
) -> std::result::Result<CrmProduct, ApiError> {
    let category_id = parse_optional_oid(input.category_id)?;
    let brand_id = parse_optional_oid(input.brand_id)?;
    let unit_id = parse_optional_oid(input.unit_id)?;

    let track = input.is_track_inventory.unwrap_or(false);
    let inventory = input.inventory.unwrap_or_default();
    let computed_total = inventory.iter().map(|row| row.stock).sum::<f64>();

    Ok(CrmProduct {
        id: None,
        user_id,
        project_id: None,
        name: input.name,
        sku: input.sku,
        description: input.description,
        category_id,
        brand_id,
        unit_id,
        cost_price: input.cost_price.unwrap_or(0.0),
        selling_price: input.selling_price.unwrap_or(0.0),
        tax_rate: input.tax_rate,
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        hsn_sac: input.hsn_sac,
        item_type: input.item_type,
        is_track_inventory: track,
        inventory,
        total_stock: input.total_stock.unwrap_or(computed_total),
        dimensions: input.dimensions,
        weight: input.weight,
        variants: input.variants,
        batches: input.batches,
        batch_tracking: input.batch_tracking,
        images: input.images,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateItemInput) -> std::result::Result<Document, ApiError> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };

    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.sku {
        set.insert("sku", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = parse_optional_oid(patch.category_id)? {
        set.insert("categoryId", v);
    }
    if let Some(v) = parse_optional_oid(patch.brand_id)? {
        set.insert("brandId", v);
    }
    if let Some(v) = parse_optional_oid(patch.unit_id)? {
        set.insert("unitId", v);
    }
    if let Some(v) = patch.cost_price {
        set.insert("costPrice", v);
    }
    if let Some(v) = patch.selling_price {
        set.insert("sellingPrice", v);
    }
    if let Some(v) = patch.tax_rate {
        set.insert("taxRate", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.hsn_sac {
        set.insert("hsnSac", v);
    }
    if let Some(v) = patch.item_type {
        set.insert("itemType", v);
    }
    if let Some(v) = patch.is_track_inventory {
        set.insert("isTrackInventory", v);
    }
    if let Some(v) = patch.inventory {
        let bson_val = bson::to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        set.insert("inventory", bson_val);
    }
    if let Some(v) = patch.total_stock {
        set.insert("totalStock", v);
    }
    if let Some(v) = patch.dimensions {
        write_dimensions(&mut set, v)?;
    }
    if let Some(v) = patch.weight {
        write_weight(&mut set, v)?;
    }
    if let Some(v) = patch.variants {
        set.insert("variants", Bson::Array(v));
    }
    if let Some(v) = patch.batches {
        set.insert("batches", Bson::Array(v));
    }
    if let Some(v) = patch.batch_tracking {
        set.insert("batchTracking", v);
    }
    if let Some(v) = patch.images {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("images", arr);
    }
    Ok(doc! { "$set": set })
}

fn write_dimensions(set: &mut Document, d: ProductDimensions) -> std::result::Result<(), ApiError> {
    let bson_val = bson::to_bson(&d).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    set.insert("dimensions", bson_val);
    Ok(())
}

fn write_weight(set: &mut Document, w: ProductWeight) -> std::result::Result<(), ApiError> {
    let bson_val = bson::to_bson(&w).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    set.insert("weight", bson_val);
    Ok(())
}

fn doc_for_audit(item: &CrmProduct) -> Document {
    bson::to_document(item).unwrap_or_default()
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_items(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = list_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // Search across the canonical fields plus the legacy `barcode` /
        // `hsn` fields some installs persist (per spec).
        let or = build_q_filter(needle, &["name", "sku", "barcode", "hsn", "hsnSac"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1) // +1 to infer hasMore without a count
        .build();

    let coll = mongo.collection::<CrmProduct>(ITEMS_COLL);
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProduct>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn get_item(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmProduct>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&item_id)?;

    let coll = mongo.collection::<CrmProduct>(ITEMS_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find_one")))?
        .ok_or_else(|| ApiError::NotFound("item".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_item(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateItemInput>,
) -> Result<Json<CreateItemResponse>> {
    // `userId` is always stamped from the JWT; `projectId` is stamped
    // only on SabCRM (project) mounts, where it is mandatory.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.sku.trim().is_empty() {
        return Err(ApiError::Validation("sku is required".to_owned()));
    }

    let coll = mongo.collection::<CrmProduct>(ITEMS_COLL);

    // SKU uniqueness within tenant — mirrors the TS legacy path.
    let mut dup_filter = scope.filter();
    dup_filter.insert("sku", input.sku.as_str());
    let dup = coll
        .find_one(dup_filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find_one")))?;
    if dup.is_some() {
        return Err(ApiError::Validation("SKU already exists".to_owned()));
    }

    let mut item = item_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        item.project_id = Some(project_oid);
    }
    let inserted = coll
        .insert_one(&item)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    item.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&item))) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateItemResponse {
        id: new_id.to_hex(),
        entity: item,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn update_item(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateItemInput>,
) -> Result<Json<CrmProduct>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&item_id)?;

    let coll = mongo.collection::<CrmProduct>(ITEMS_COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.find_one")))?
        .ok_or_else(|| ApiError::NotFound("item".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("item".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.refetch")))?
        .ok_or_else(|| ApiError::NotFound("item".to_owned()))?;

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

// ─── DELETE /:id ────────────────────────────────────────────────────────

/// Hard delete — `CrmProduct` has no `archived` / `status` field, and the
/// legacy `deleteCrmProduct` server action also hard-deletes. Audit log
/// still records the action for forensic traceability.
#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn delete_item(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteItemResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&item_id)?;

    let coll = mongo.collection::<CrmProduct>(ITEMS_COLL);
    let result = coll
        .delete_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_products.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("item".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteItemResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn list_filter_contains_user_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid));
        assert!(f.contains_key("userId"));
        assert!(!f.contains_key("projectId"));
        // No archived/status field — TS shape has no soft-delete column.
        assert!(!f.contains_key("status"));
        assert!(!f.contains_key("archived"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn ownership_filter_scopes_both_id_and_user() {
        let user = ObjectId::new();
        let item = ObjectId::new();
        let f = ownership_filter(&TenantScope::User(user), item);
        assert!(f.contains_key("_id"));
        assert!(f.contains_key("userId"));
    }

    #[test]
    fn resolve_scope_project_requires_project_id() {
        let user = AuthUser {
            user_id: ObjectId::new().to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        };
        assert!(resolve_scope(ScopeMode::Project, &user, None).is_err());
        let p = ObjectId::new();
        let scope = resolve_scope(ScopeMode::Project, &user, Some(&p.to_hex())).unwrap();
        assert_eq!(scope, TenantScope::Project(p));
    }

    #[test]
    fn build_update_doc_omits_unset_fields() {
        let patch = UpdateItemInput {
            name: Some("Widget".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("name").unwrap(), "Widget");
        assert!(!set.contains_key("sku"));
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn build_update_doc_renames_camel_case_fields() {
        let patch = UpdateItemInput {
            cost_price: Some(99.0),
            selling_price: Some(120.0),
            hsn_sac: Some("8473".into()),
            is_track_inventory: Some(true),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert!(set.contains_key("costPrice"));
        assert!(set.contains_key("sellingPrice"));
        assert!(set.contains_key("hsnSac"));
        assert!(set.contains_key("isTrackInventory"));
    }

    #[test]
    fn item_from_create_defaults_currency_inr() {
        let user_id = ObjectId::new();
        let input = CreateItemInput {
            name: "Widget".into(),
            sku: "WID-1".into(),
            ..Default::default()
        };
        let item = item_from_create(input, user_id).unwrap();
        assert_eq!(item.currency, "INR");
        assert_eq!(item.user_id, user_id);
        assert!(item.id.is_none());
        assert!(!item.is_track_inventory);
    }

    #[test]
    fn item_from_create_sums_total_stock_from_inventory() {
        use crate::types::ProductInventoryRow;

        let user_id = ObjectId::new();
        let input = CreateItemInput {
            name: "Widget".into(),
            sku: "WID-1".into(),
            is_track_inventory: Some(true),
            inventory: Some(vec![
                ProductInventoryRow {
                    warehouse_id: ObjectId::new(),
                    stock: 12.0,
                    reorder_point: None,
                },
                ProductInventoryRow {
                    warehouse_id: ObjectId::new(),
                    stock: 8.0,
                    reorder_point: Some(5.0),
                },
            ]),
            ..Default::default()
        };
        let item = item_from_create(input, user_id).unwrap();
        assert_eq!(item.total_stock, 20.0);
        assert_eq!(item.inventory.len(), 2);
    }

    #[test]
    fn item_from_create_respects_explicit_total_stock() {
        let user_id = ObjectId::new();
        let input = CreateItemInput {
            name: "Widget".into(),
            sku: "WID-1".into(),
            total_stock: Some(99.0),
            ..Default::default()
        };
        let item = item_from_create(input, user_id).unwrap();
        assert_eq!(item.total_stock, 99.0);
    }

    #[test]
    fn parse_optional_oid_rejects_garbage() {
        let r = parse_optional_oid(Some("not-an-oid".to_owned()));
        assert!(r.is_err());
    }

    #[test]
    fn parse_optional_oid_treats_empty_as_none() {
        let r = parse_optional_oid(Some("".to_owned())).unwrap();
        assert!(r.is_none());
        let r = parse_optional_oid(Some("   ".to_owned())).unwrap();
        assert!(r.is_none());
        let r = parse_optional_oid(None).unwrap();
        assert!(r.is_none());
    }
}
