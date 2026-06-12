//! HTTP handlers for the Bank Reconciliation entity.

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
    CreateReconciliationInput, CreateReconciliationResponse, DeleteReconciliationResponse,
    ListQuery, UpdateReconciliationInput,
};
use crate::dto::ScopeQuery;
use crate::types::CrmReconciliation;

const COLL: &str = "crm_reconciliations";
const ENTITY_KIND: &str = "reconciliation";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId`.
fn resolve_scope(mode: ScopeMode, user: &AuthUser, project_id: Option<&str>) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

fn list_filter(
    scope: &TenantScope, status: Option<&str>, account_id: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "in_progress" | "completed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(hex) = account_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("accountId", hex);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn reconciliation_from_create(
    input: CreateReconciliationInput,
    user_id: ObjectId,
) -> Result<CrmReconciliation> {
    let account_id = ObjectId::parse_str(input.account_id.trim())
        .map_err(|_| ApiError::Validation("accountId must be a valid ObjectId".to_owned()))?;
    let period_start = parse_date(input.period_start.trim())
        .ok_or_else(|| ApiError::Validation("periodStart must be an RFC3339 date".to_owned()))?;
    let period_end = parse_date(input.period_end.trim())
        .ok_or_else(|| ApiError::Validation("periodEnd must be an RFC3339 date".to_owned()))?;
    if period_end < period_start {
        return Err(ApiError::Validation(
            "periodEnd must be on or after periodStart".to_owned(),
        ));
    }
    let status = input.status.unwrap_or_else(|| "in_progress".to_owned());
    let finalized_at = if status == "completed" {
        Some(BsonDateTime::from_chrono(Utc::now()))
    } else {
        None
    };
    Ok(CrmReconciliation {
        id: None,
        user_id,
        project_id: None,
        account_id,
        period_start,
        period_end,
        opening_balance: input.opening_balance.unwrap_or(0.0),
        closing_balance: input.closing_balance.unwrap_or(0.0),
        matched_count: input.matched_count.unwrap_or(0),
        unmatched_count: input.unmatched_count.unwrap_or(0),
        notes: input.notes,
        status,
        finalized_at,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateReconciliationInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(ref s) = patch.account_id {
        let oid = ObjectId::parse_str(s.trim())
            .map_err(|_| ApiError::Validation("accountId must be a valid ObjectId".to_owned()))?;
        set.insert("accountId", oid);
    }
    if let Some(v) = patch.period_start.as_deref().and_then(parse_date) {
        set.insert("periodStart", v);
    }
    if let Some(v) = patch.period_end.as_deref().and_then(parse_date) {
        set.insert("periodEnd", v);
    }
    if let Some(v) = patch.opening_balance {
        set.insert("openingBalance", v);
    }
    if let Some(v) = patch.closing_balance {
        set.insert("closingBalance", v);
    }
    if let Some(v) = patch.matched_count {
        set.insert("matchedCount", v);
    }
    if let Some(v) = patch.unmatched_count {
        set.insert("unmatchedCount", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(ref status) = patch.status {
        set.insert("status", status);
        if status == "completed" && patch.finalized_at.is_none() {
            set.insert("finalizedAt", BsonDateTime::from_chrono(Utc::now()));
        }
    }
    if let Some(v) = patch.finalized_at.as_deref().and_then(parse_date) {
        set.insert("finalizedAt", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmReconciliation) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmReconciliation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_reconciliations(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope, q.status.as_deref(), q.account_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["notes", "status"]);
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
    let coll = mongo.collection::<CrmReconciliation>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.find"))
    })?;
    let mut rows: Vec<CrmReconciliation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %reconciliation_id))]
pub async fn get_reconciliation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(reconciliation_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmReconciliation>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&reconciliation_id)?;
    let coll = mongo.collection::<CrmReconciliation>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("reconciliation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_reconciliation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateReconciliationInput>,
) -> Result<Json<CreateReconciliationResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = reconciliation_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmReconciliation>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.insert"))
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
    Ok(Json(CreateReconciliationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %reconciliation_id))]
pub async fn update_reconciliation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(reconciliation_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateReconciliationInput>,
) -> Result<Json<CrmReconciliation>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&reconciliation_id)?;
    let coll = mongo.collection::<CrmReconciliation>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("reconciliation".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("reconciliation".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("reconciliation".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %reconciliation_id))]
pub async fn delete_reconciliation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(reconciliation_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteReconciliationResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&reconciliation_id)?;
    let coll = mongo.collection::<CrmReconciliation>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_reconciliations.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("reconciliation".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteReconciliationResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("accountId"));
    }

    #[test]
    fn list_filter_applies_account_id_when_valid_hex() {
        let oid = ObjectId::new();
        let acct = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), Some("all"), Some(&acct.to_hex()));
        assert_eq!(f.get_object_id("accountId").unwrap(), acct);
        // status=all should not pin status
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn reconciliation_from_create_rejects_bad_account_id() {
        let user_id = ObjectId::new();
        let input = CreateReconciliationInput {
            account_id: "not-an-oid".into(),
            period_start: "2026-01-01T00:00:00Z".into(),
            period_end: "2026-01-31T23:59:59Z".into(),
            ..Default::default()
        };
        assert!(reconciliation_from_create(input, user_id).is_err());
    }

    #[test]
    fn reconciliation_from_create_defaults_status_in_progress() {
        let user_id = ObjectId::new();
        let acct = ObjectId::new().to_hex();
        let input = CreateReconciliationInput {
            account_id: acct,
            period_start: "2026-01-01T00:00:00Z".into(),
            period_end: "2026-01-31T23:59:59Z".into(),
            ..Default::default()
        };
        let r = reconciliation_from_create(input, user_id).unwrap();
        assert_eq!(r.status, "in_progress");
        assert!(r.finalized_at.is_none());
        assert_eq!(r.opening_balance, 0.0);
    }

    #[test]
    fn list_filter_user_scope_filters_user_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), Some("all"), None);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn list_filter_project_scope_filters_project_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), Some("all"), None);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn ownership_filter_scopes_by_tenant_key() {
        let tenant = ObjectId::new();
        let id = ObjectId::new();
        let user_f = ownership_filter(&TenantScope::User(tenant), id);
        assert_eq!(user_f.get_object_id("userId").unwrap(), tenant);
        assert_eq!(user_f.get_object_id("_id").unwrap(), id);
        let proj_f = ownership_filter(&TenantScope::Project(tenant), id);
        assert_eq!(proj_f.get_object_id("projectId").unwrap(), tenant);
        assert_eq!(proj_f.get_object_id("_id").unwrap(), id);
        assert!(!proj_f.contains_key("userId"));
    }
}
