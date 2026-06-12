//! HTTP handlers for the Stock Adjustment entity.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    ApprovalInput, CreateStockAdjustmentInput, CreateStockAdjustmentResponse,
    DeleteStockAdjustmentResponse, LineInput, ListQuery, ScopeQuery, UpdateStockAdjustmentInput,
};
use crate::types::{CrmStockAdjustment, CrmStockAdjustmentLine};

const COLL: &str = "crm_stock_adjustments";
const ENTITY_KIND: &str = "stock_adjustment";

fn parse_iso(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

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

fn list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    warehouse_id: Option<&str>,
    product_id: Option<&str>,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    if let Some(s) = status
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "all")
    {
        filter.insert("status", s);
    }
    if let Some(wid) = warehouse_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("warehouseId", wid);
    }
    if let Some(pid) = product_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("productId", pid);
    }
    let mut range = Document::new();
    if let Some(d) = date_from.and_then(parse_iso) {
        range.insert("$gte", d);
    }
    if let Some(d) = date_to.and_then(parse_iso) {
        range.insert("$lt", d);
    }
    if !range.is_empty() {
        filter.insert("date", range);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn line_input_to_line(input: LineInput) -> Option<CrmStockAdjustmentLine> {
    let product_id = ObjectId::parse_str(&input.product_id).ok()?;
    Some(CrmStockAdjustmentLine {
        product_id,
        product_name: input.product_name,
        qty_before: input.qty_before,
        qty_after: input.qty_after,
        delta: input.delta,
        batch: input.batch,
        serial: input.serial,
        cost_per_unit: input.cost_per_unit,
    })
}

fn from_create(input: CreateStockAdjustmentInput, user_id: ObjectId) -> Result<CrmStockAdjustment> {
    let warehouse_id = ObjectId::parse_str(&input.warehouse_id)
        .map_err(|_| ApiError::Validation("warehouseId is not a valid id".to_owned()))?;
    let product_id = ObjectId::parse_str(&input.product_id)
        .map_err(|_| ApiError::Validation("productId is not a valid id".to_owned()))?;

    let date = input
        .date
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now()));

    let lines = input
        .lines
        .into_iter()
        .filter_map(line_input_to_line)
        .collect();

    Ok(CrmStockAdjustment {
        id: None,
        user_id,
        project_id: None,
        adjustment_number: input.adjustment_number,
        date,
        reason: input.reason,
        reference_number: input.reference_number,
        warehouse_id,
        product_id,
        quantity: input.quantity,
        cost_per_unit: input.cost_per_unit,
        lines,
        status: input.status.or_else(|| Some("pending".to_owned())),
        approved_by: None,
        approved_by_name: None,
        approved_at: None,
        approval_notes: None,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn lines_to_bson(lines: Vec<LineInput>) -> Bson {
    let docs: Vec<Document> = lines
        .into_iter()
        .filter_map(line_input_to_line)
        .filter_map(|l| bson::to_document(&l).ok())
        .collect();
    Bson::Array(docs.into_iter().map(Bson::Document).collect())
}

fn build_update_doc(patch: UpdateStockAdjustmentInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.adjustment_number {
        set.insert("adjustmentNumber", v);
    }
    if let Some(v) = patch.date.as_deref().and_then(parse_iso) {
        set.insert("date", v);
    }
    if let Some(v) = patch.reason {
        set.insert("reason", v);
    }
    if let Some(v) = patch.reference_number {
        set.insert("referenceNumber", v);
    }
    if let Some(v) = patch
        .warehouse_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("warehouseId", v);
    }
    if let Some(v) = patch
        .product_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("productId", v);
    }
    if let Some(v) = patch.quantity {
        set.insert("quantity", v);
    }
    if let Some(v) = patch.cost_per_unit {
        set.insert("costPerUnit", v);
    }
    if let Some(lines) = patch.lines {
        set.insert("lines", lines_to_bson(lines));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmStockAdjustment) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmStockAdjustment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_adjustments(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.warehouse_id.as_deref(),
        q.product_id.as_deref(),
        q.date_from.as_deref(),
        q.date_to.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["adjustmentNumber", "reason", "referenceNumber"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "date": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.find"))
    })?;
    let mut rows: Vec<CrmStockAdjustment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %adjustment_id))]
pub async fn get_adjustment(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(adjustment_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStockAdjustment>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&adjustment_id)?;

    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("stock_adjustment".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_adjustment(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStockAdjustmentInput>,
) -> Result<Json<CreateStockAdjustmentResponse>> {
    // `userId` is always stamped from the JWT; `projectId` is stamped
    // only on SabCRM (project) mounts, where it is mandatory.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    if input.reason.trim().is_empty() {
        return Err(ApiError::Validation("reason is required".to_owned()));
    }

    let mut entity = from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.insert"))
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

    Ok(Json(CreateStockAdjustmentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %adjustment_id))]
pub async fn update_adjustment(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(adjustment_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateStockAdjustmentInput>,
) -> Result<Json<CrmStockAdjustment>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&adjustment_id)?;

    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("stock_adjustment".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("stock_adjustment".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("stock_adjustment".to_owned()))?;

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

/// Approval workflow endpoint — `POST /:id/approval` with `{decision, notes?}`.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %adjustment_id))]
pub async fn approval_decision(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(adjustment_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(input): Json<ApprovalInput>,
) -> Result<Json<CrmStockAdjustment>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    // The approver is always the JWT subject, whichever mount served the
    // request — `approvedBy` is an audit field, not the tenant scope.
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&adjustment_id)?;

    let status = match input.decision.as_str() {
        "approve" => "approved",
        "reject" => "rejected",
        _ => {
            return Err(ApiError::Validation(
                "decision must be 'approve' or 'reject'".to_owned(),
            ));
        }
    };

    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let mut set = doc! {
        "status": status,
        "approvedBy": user_id,
        "approvedAt": BsonDateTime::from_chrono(Utc::now()),
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(n) = input.notes {
        set.insert("approvalNotes", n);
    }
    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.approve"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("stock_adjustment".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("stock_adjustment".to_owned()))?;

    if let Some(event) =
        audit_for_update(&user, ENTITY_KIND, oid, None, Some(doc_for_audit(&after)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %adjustment_id))]
pub async fn delete_adjustment(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(adjustment_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteStockAdjustmentResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&adjustment_id)?;

    let coll = mongo.collection::<CrmStockAdjustment>(COLL);
    let result = coll
        .delete_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_stock_adjustments.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("stock_adjustment".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteStockAdjustmentResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_with_warehouse_and_product() {
        let uid = ObjectId::new();
        let wid = ObjectId::new();
        let pid = ObjectId::new();
        let f = list_filter(
            &TenantScope::User(uid),
            Some("approved"),
            Some(&wid.to_hex()),
            Some(&pid.to_hex()),
            None,
            None,
        );
        assert_eq!(f.get_str("status").unwrap(), "approved");
        assert!(f.get("warehouseId").is_some());
        assert!(f.get("productId").is_some());
        assert_eq!(f.get_object_id("userId").unwrap(), uid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn list_filter_all_omits_status_clause() {
        let uid = ObjectId::new();
        let f = list_filter(&TenantScope::User(uid), Some("all"), None, None, None, None);
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None, None, None, None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
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
    fn from_create_stamps_pending_status_when_missing() {
        let uid = ObjectId::new();
        let wid = ObjectId::new();
        let pid = ObjectId::new();
        let input = CreateStockAdjustmentInput {
            reason: "Damage".into(),
            warehouse_id: wid.to_hex(),
            product_id: pid.to_hex(),
            quantity: -3.0,
            ..Default::default()
        };
        let e = from_create(input, uid).unwrap();
        assert_eq!(e.status.as_deref(), Some("pending"));
        assert_eq!(e.warehouse_id, wid);
        assert_eq!(e.product_id, pid);
        assert_eq!(e.quantity, -3.0);
    }

    #[test]
    fn from_create_rejects_invalid_warehouse_id() {
        let uid = ObjectId::new();
        let pid = ObjectId::new();
        let input = CreateStockAdjustmentInput {
            reason: "Damage".into(),
            warehouse_id: "not-an-oid".into(),
            product_id: pid.to_hex(),
            quantity: 1.0,
            ..Default::default()
        };
        assert!(from_create(input, uid).is_err());
    }
}
