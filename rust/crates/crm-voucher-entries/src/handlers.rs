//! HTTP handlers for the Voucher Entry entity.

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
    CreateEntryInput, CreateEntryResponse, DeleteEntryResponse, ListQuery, ScopeQuery,
    UpdateEntryInput, VoucherLineInput,
};
use crate::types::{CrmVoucherEntry, VoucherLine};

const COLL: &str = "crm_voucher_entries";
const ENTITY_KIND: &str = "voucher_entry";
const BALANCE_TOLERANCE: f64 = 0.01;

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
    voucher_book_id: Option<&str>,
) -> Result<Document> {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "posted" | "draft" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(book) = voucher_book_id.map(str::trim).filter(|s| !s.is_empty()) {
        let oid = ObjectId::parse_str(book)
            .map_err(|_| ApiError::Validation("invalid voucherBookId".to_owned()))?;
        filter.insert("voucherBookId", oid);
    }
    Ok(filter)
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

fn sum_lines(lines: &[VoucherLine]) -> f64 {
    lines.iter().map(|l| l.amount).sum()
}

fn convert_lines(inputs: Vec<VoucherLineInput>) -> Result<Vec<VoucherLine>> {
    inputs
        .into_iter()
        .map(VoucherLineInput::into_line)
        .collect()
}

fn entry_from_create(input: CreateEntryInput, user_id: ObjectId) -> Result<CrmVoucherEntry> {
    let book_id = ObjectId::parse_str(input.voucher_book_id.trim())
        .map_err(|_| ApiError::Validation("voucherBookId must be a valid ObjectId".to_owned()))?;

    if input.voucher_number.trim().is_empty() {
        return Err(ApiError::Validation("voucherNumber is required".to_owned()));
    }
    let date = parse_date(input.date.trim())
        .ok_or_else(|| ApiError::Validation("date must be a valid RFC3339 string".to_owned()))?;

    let debit_entries = convert_lines(input.debit_entries)?;
    let credit_entries = convert_lines(input.credit_entries)?;

    let total_debit = sum_lines(&debit_entries);
    let total_credit = sum_lines(&credit_entries);

    if (total_debit - total_credit).abs() > BALANCE_TOLERANCE {
        return Err(ApiError::Validation(format!(
            "voucher entry does not balance: debit {total_debit} vs credit {total_credit}"
        )));
    }

    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("posted")
        .to_owned();

    Ok(CrmVoucherEntry {
        id: None,
        user_id,
        project_id: None,
        voucher_book_id: book_id,
        voucher_number: input.voucher_number.trim().to_owned(),
        date,
        narration: input.narration,
        debit_entries,
        credit_entries,
        total_debit,
        total_credit,
        status,
        reference: input.reference,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEntryInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };

    if let Some(book) = patch.voucher_book_id.as_deref().map(str::trim) {
        if !book.is_empty() {
            let oid = ObjectId::parse_str(book).map_err(|_| {
                ApiError::Validation("voucherBookId must be a valid ObjectId".to_owned())
            })?;
            set.insert("voucherBookId", oid);
        }
    }
    if let Some(v) = patch.voucher_number {
        if !v.trim().is_empty() {
            set.insert("voucherNumber", v.trim().to_owned());
        }
    }
    if let Some(v) = patch.date.as_deref().and_then(parse_date) {
        set.insert("date", v);
    }
    if let Some(v) = patch.narration {
        set.insert("narration", v);
    }
    if let Some(v) = patch.reference {
        set.insert("reference", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    // If either side of the ledger is patched, replace both and recompute totals.
    // Both must be sent together to remain consistent and balanced.
    match (patch.debit_entries, patch.credit_entries) {
        (Some(d), Some(c)) => {
            let debit_lines = convert_lines(d)?;
            let credit_lines = convert_lines(c)?;
            let total_debit = sum_lines(&debit_lines);
            let total_credit = sum_lines(&credit_lines);
            if (total_debit - total_credit).abs() > BALANCE_TOLERANCE {
                return Err(ApiError::Validation(format!(
                    "voucher entry does not balance: debit {total_debit} vs credit {total_credit}"
                )));
            }
            let debit_docs: Vec<Document> = debit_lines
                .iter()
                .filter_map(|l| bson::to_document(l).ok())
                .collect();
            let credit_docs: Vec<Document> = credit_lines
                .iter()
                .filter_map(|l| bson::to_document(l).ok())
                .collect();
            set.insert("debitEntries", debit_docs);
            set.insert("creditEntries", credit_docs);
            set.insert("totalDebit", total_debit);
            set.insert("totalCredit", total_credit);
        }
        (Some(_), None) | (None, Some(_)) => {
            return Err(ApiError::Validation(
                "debitEntries and creditEntries must be patched together".to_owned(),
            ));
        }
        (None, None) => {}
    }

    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmVoucherEntry) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmVoucherEntry>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_entries(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref(), q.voucher_book_id.as_deref())?;
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["voucherNumber", "narration", "reference"]);
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
    let coll = mongo.collection::<CrmVoucherEntry>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.find"))
    })?;
    let mut rows: Vec<CrmVoucherEntry> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %entry_id))]
pub async fn get_entry(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(entry_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmVoucherEntry>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&entry_id)?;
    let coll = mongo.collection::<CrmVoucherEntry>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_entry".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_entry(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEntryInput>,
) -> Result<Json<CreateEntryResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = entry_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmVoucherEntry>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.insert"))
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
    Ok(Json(CreateEntryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %entry_id))]
pub async fn update_entry(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(entry_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateEntryInput>,
) -> Result<Json<CrmVoucherEntry>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&entry_id)?;
    let coll = mongo.collection::<CrmVoucherEntry>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_entry".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voucher_entry".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_entry".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %entry_id))]
pub async fn delete_entry(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(entry_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteEntryResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&entry_id)?;
    let coll = mongo.collection::<CrmVoucherEntry>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_entries.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voucher_entry".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteEntryResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok_line(amount: f64) -> VoucherLineInput {
        VoucherLineInput {
            account_id: ObjectId::new().to_hex(),
            amount,
            description: None,
        }
    }

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None).unwrap();
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None, None).unwrap();
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn entry_from_create_balances_and_seeds_defaults() {
        let user_id = ObjectId::new();
        let book_id = ObjectId::new().to_hex();
        let input = CreateEntryInput {
            voucher_book_id: book_id,
            voucher_number: "JV-001".into(),
            date: "2026-01-15T00:00:00Z".into(),
            narration: Some("monthly accrual".into()),
            debit_entries: vec![ok_line(100.0), ok_line(50.0)],
            credit_entries: vec![ok_line(150.0)],
            status: None,
            reference: None,
            project_id: None,
        };
        let e = entry_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "posted");
        assert!((e.total_debit - 150.0).abs() < f64::EPSILON);
        assert!((e.total_credit - 150.0).abs() < f64::EPSILON);
        assert_eq!(e.debit_entries.len(), 2);
        assert_eq!(e.credit_entries.len(), 1);
    }

    #[test]
    fn entry_from_create_rejects_unbalanced_totals() {
        let user_id = ObjectId::new();
        let input = CreateEntryInput {
            voucher_book_id: ObjectId::new().to_hex(),
            voucher_number: "JV-002".into(),
            date: "2026-01-15T00:00:00Z".into(),
            narration: None,
            debit_entries: vec![ok_line(100.0)],
            credit_entries: vec![ok_line(99.0)],
            status: None,
            reference: None,
            project_id: None,
        };
        let err = entry_from_create(input, user_id).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn entry_from_create_rejects_invalid_book_id() {
        let user_id = ObjectId::new();
        let input = CreateEntryInput {
            voucher_book_id: "not-an-objectid".into(),
            voucher_number: "JV-003".into(),
            date: "2026-01-15T00:00:00Z".into(),
            narration: None,
            debit_entries: vec![ok_line(10.0)],
            credit_entries: vec![ok_line(10.0)],
            status: None,
            reference: None,
            project_id: None,
        };
        assert!(matches!(
            entry_from_create(input, user_id).unwrap_err(),
            ApiError::Validation(_)
        ));
    }

    #[test]
    fn entry_from_create_rejects_empty_voucher_number() {
        let user_id = ObjectId::new();
        let input = CreateEntryInput {
            voucher_book_id: ObjectId::new().to_hex(),
            voucher_number: "   ".into(),
            date: "2026-01-15T00:00:00Z".into(),
            narration: None,
            debit_entries: vec![],
            credit_entries: vec![],
            status: None,
            reference: None,
            project_id: None,
        };
        assert!(matches!(
            entry_from_create(input, user_id).unwrap_err(),
            ApiError::Validation(_)
        ));
    }
}
