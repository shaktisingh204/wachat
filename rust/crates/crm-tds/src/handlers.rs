//! HTTP handlers for the TDS Record entity.

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
    CreateTdsRecordInput, CreateTdsRecordResponse, DeleteTdsRecordResponse, ListQuery, ScopeQuery,
    UpdateTdsRecordInput,
};
use crate::types::CrmTdsRecord;

const COLL: &str = "crm_tds_records";
const ENTITY_KIND: &str = "tds_record";

const VALID_STATUSES: &[&str] = &["pending", "deposited", "filed", "archived"];
const VALID_QUARTERS: &[&str] = &["Q1", "Q2", "Q3", "Q4"];

fn parse_iso_date(s: &str) -> Result<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map(|nd| BsonDateTime::from_chrono(nd.and_hms_opt(0, 0, 0).unwrap().and_utc()))
        })
        .map_err(|_| ApiError::Validation(format!("invalid date '{s}'")))
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

fn list_filter(scope: &TenantScope, q: &ListQuery) -> Document {
    let mut filter = scope.filter();
    match q.status.as_deref().unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        s if VALID_STATUSES.contains(&s) => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(v) = q.financial_year.as_deref() {
        filter.insert("financialYear", v);
    }
    if let Some(v) = q.quarter.as_deref()
        && VALID_QUARTERS.contains(&v)
    {
        filter.insert("quarter", v);
    }
    if let Some(v) = q.employee_id.as_deref() {
        filter.insert("employeeId", v);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn entity_from_create(input: CreateTdsRecordInput, user_id: ObjectId) -> Result<CrmTdsRecord> {
    if input.employee_name.trim().is_empty() {
        return Err(ApiError::Validation("employee_name is required".to_owned()));
    }
    if input.financial_year.trim().is_empty() {
        return Err(ApiError::Validation(
            "financial_year is required".to_owned(),
        ));
    }
    if !VALID_QUARTERS.contains(&input.quarter.as_str()) {
        return Err(ApiError::Validation(
            "quarter must be Q1, Q2, Q3 or Q4".to_owned(),
        ));
    }
    let status = input
        .status
        .filter(|s| VALID_STATUSES.contains(&s.as_str()))
        .unwrap_or_else(|| "pending".to_owned());
    let deposit_date = match input.deposit_date.as_deref() {
        Some(s) if !s.is_empty() => Some(parse_iso_date(s)?),
        _ => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(CrmTdsRecord {
        id: None,
        user_id,
        project_id: None,
        employee_id: input.employee_id,
        employee_name: input.employee_name.trim().to_string(),
        financial_year: input.financial_year.trim().to_string(),
        quarter: input.quarter,
        tds_amount: input.tds_amount,
        gross_amount: input.gross_amount,
        certificate_number: input.certificate_number,
        deposit_challan_number: input.deposit_challan_number,
        deposit_date,
        status,
        notes: input.notes,
        created_at: now,
        updated_at: now,
    })
}

fn build_update_doc(patch: UpdateTdsRecordInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v.trim());
    }
    if let Some(v) = patch.financial_year {
        set.insert("financialYear", v.trim());
    }
    if let Some(v) = patch.quarter {
        if !VALID_QUARTERS.contains(&v.as_str()) {
            return Err(ApiError::Validation(
                "quarter must be Q1, Q2, Q3 or Q4".to_owned(),
            ));
        }
        set.insert("quarter", v);
    }
    if let Some(v) = patch.tds_amount {
        set.insert("tdsAmount", v);
    }
    if let Some(v) = patch.gross_amount {
        set.insert("grossAmount", v);
    }
    if let Some(v) = patch.certificate_number {
        set.insert("certificateNumber", v);
    }
    if let Some(v) = patch.deposit_challan_number {
        set.insert("depositChallanNumber", v);
    }
    if let Some(v) = patch.deposit_date {
        set.insert("depositDate", parse_iso_date(&v)?);
    }
    if let Some(v) = patch.status {
        if !VALID_STATUSES.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid status".to_owned()));
        }
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmTdsRecord) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTdsRecord>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tds(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "employeeName",
                "certificateNumber",
                "depositChallanNumber",
                "financialYear",
            ],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "financialYear": -1, "quarter": 1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmTdsRecord>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.find")))?;
    let mut rows: Vec<CrmTdsRecord> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn get_tds(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmTdsRecord>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&record_id)?;
    let coll = mongo.collection::<CrmTdsRecord>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tds_record".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_tds(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTdsRecordInput>,
) -> Result<Json<CreateTdsRecordResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmTdsRecord>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTdsRecordResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn update_tds(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateTdsRecordInput>,
) -> Result<Json<CrmTdsRecord>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&record_id)?;

    let coll = mongo.collection::<CrmTdsRecord>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tds_record".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tds_record".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.refetch")))?
        .ok_or_else(|| ApiError::NotFound("tds_record".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn delete_tds(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteTdsRecordResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&record_id)?;

    let coll = mongo.collection::<CrmTdsRecord>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tds.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tds_record".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTdsRecordResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let q = ListQuery::default();
        let f = list_filter(&TenantScope::User(oid), &q);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let q = ListQuery::default();
        let f = list_filter(&TenantScope::Project(oid), &q);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn entity_from_create_stamps_pending_status() {
        let user_id = ObjectId::new();
        let input = CreateTdsRecordInput {
            employee_name: "Alice".into(),
            financial_year: "2025-26".into(),
            quarter: "Q1".into(),
            tds_amount: 12500.0,
            gross_amount: 125000.0,
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "pending");
        assert_eq!(e.quarter, "Q1");
        assert_eq!(e.employee_name, "Alice");
    }

    #[test]
    fn entity_from_create_rejects_bad_quarter() {
        let user_id = ObjectId::new();
        let input = CreateTdsRecordInput {
            employee_name: "Alice".into(),
            financial_year: "2025-26".into(),
            quarter: "Q5".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn entity_from_create_rejects_empty_employee_name() {
        let user_id = ObjectId::new();
        let input = CreateTdsRecordInput {
            employee_name: "  ".into(),
            financial_year: "2025-26".into(),
            quarter: "Q2".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }
}
