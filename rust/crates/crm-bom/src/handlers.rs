//! HTTP handlers for the BOM entity.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateBomInput, CreateBomResponse, DeleteBomResponse, ListQuery, ScopeQuery, UpdateBomInput,
};
use crate::types::CrmBom;

const COLL: &str = "crm_boms";
const ENTITY_KIND: &str = "bom";

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

fn list_filter(scope: &TenantScope, status: Option<&str>, fg_id: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "obsolete" => {
            filter.insert("status", "obsolete");
        }
        "active" => {
            filter.insert("status", "active");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(fg) = fg_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("finishedGoodId", fg);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn bom_from_create(input: CreateBomInput, user_id: ObjectId) -> Result<CrmBom> {
    if input.bom_no.trim().is_empty() {
        return Err(ApiError::Validation("bomNo is required".to_owned()));
    }
    if input.finished_good_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "finishedGoodName is required".to_owned(),
        ));
    }
    if input.output_qty <= 0.0 {
        return Err(ApiError::Validation(
            "outputQty must be positive".to_owned(),
        ));
    }
    let fg = input
        .finished_good_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    let effective = input.effective_date.as_deref().and_then(parse_date);
    Ok(CrmBom {
        id: None,
        user_id,
        project_id: None,
        bom_no: input.bom_no.trim().to_owned(),
        finished_good_name: input.finished_good_name.trim().to_owned(),
        finished_good_id: fg,
        output_qty: input.output_qty,
        unit: input.unit,
        effective_date: effective,
        version: input.version.unwrap_or_else(|| "v1".to_owned()),
        notes: input.notes,
        status: Some("draft".to_owned()),
        active: Some(false),
        components: input.components,
        labour_cost: input.labour_cost,
        overhead_cost: input.overhead_cost,
        total_cost: input.total_cost,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateBomInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.bom_no {
        set.insert("bomNo", v);
    }
    if let Some(v) = patch.finished_good_name {
        set.insert("finishedGoodName", v);
    }
    if let Some(v) = patch
        .finished_good_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("finishedGoodId", v);
    }
    if let Some(v) = patch.output_qty {
        set.insert("outputQty", v);
    }
    if let Some(v) = patch.unit {
        set.insert("unit", v);
    }
    if let Some(v) = patch.effective_date.as_deref().and_then(parse_date) {
        set.insert("effectiveDate", v);
    }
    if let Some(v) = patch.version {
        set.insert("version", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.active {
        set.insert("active", v);
    }
    if let Some(v) = patch.components {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("components", arr);
    }
    if let Some(v) = patch.labour_cost {
        set.insert("labourCost", v);
    }
    if let Some(v) = patch.overhead_cost {
        set.insert("overheadCost", v);
    }
    if let Some(v) = patch.total_cost {
        set.insert("totalCost", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmBom) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmBom>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_boms(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref(), q.finished_good_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["bomNo", "finishedGoodName", "notes", "version"]);
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
    let coll = mongo.collection::<CrmBom>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.find")))?;
    let mut rows: Vec<CrmBom> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bom_id))]
pub async fn get_bom(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bom_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmBom>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&bom_id)?;
    let coll = mongo.collection::<CrmBom>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bom".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_bom(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBomInput>,
) -> Result<Json<CreateBomResponse>> {
    // `userId` is always stamped from the JWT; `projectId` is stamped
    // only on SabCRM (project) mounts, where it is mandatory.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let mut entity = bom_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmBom>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateBomResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bom_id))]
pub async fn update_bom(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bom_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateBomInput>,
) -> Result<Json<CrmBom>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&bom_id)?;
    let coll = mongo.collection::<CrmBom>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bom".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bom".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.refetch")))?
        .ok_or_else(|| ApiError::NotFound("bom".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bom_id))]
pub async fn delete_bom(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bom_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteBomResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&bom_id)?;
    let coll = mongo.collection::<CrmBom>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "active": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_boms.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bom".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteBomResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None);
        assert!(f.contains_key("status"));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None, None);
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
    fn bom_from_create_seeds_status_draft() {
        let user_id = ObjectId::new();
        let input = CreateBomInput {
            bom_no: "BOM-001".into(),
            finished_good_name: "Widget".into(),
            output_qty: 10.0,
            unit: "pcs".into(),
            ..Default::default()
        };
        let b = bom_from_create(input, user_id).unwrap();
        assert_eq!(b.status.as_deref(), Some("draft"));
        assert_eq!(b.active, Some(false));
        assert_eq!(b.version, "v1");
    }

    #[test]
    fn bom_from_create_rejects_zero_output() {
        let user_id = ObjectId::new();
        let input = CreateBomInput {
            bom_no: "BOM-001".into(),
            finished_good_name: "Widget".into(),
            output_qty: 0.0,
            unit: "pcs".into(),
            ..Default::default()
        };
        assert!(bom_from_create(input, user_id).is_err());
    }
}
