//! HTTP handlers for the Bank Transaction entity.

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
    CreateBankTransactionInput, CreateBankTransactionResponse, DeleteBankTransactionResponse,
    ListQuery, UpdateBankTransactionInput,
};
use crate::dto::ScopeQuery;
use crate::types::CrmBankTransaction;

const COLL: &str = "crm_bank_transactions";
const ENTITY_KIND: &str = "bank_transaction";

const VALID_KINDS: &[&str] = &["debit", "credit"];
const VALID_STATUSES: &[&str] = &["pending", "cleared", "reconciled", "archived"];

fn parse_iso_date(s: &str) -> Result<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
        .or_else(|_| {
            // Fall back to YYYY-MM-DD by assuming midnight UTC.
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map(|nd| BsonDateTime::from_chrono(nd.and_hms_opt(0, 0, 0).unwrap().and_utc()))
        })
        .map_err(|_| ApiError::Validation(format!("invalid date '{s}'")))
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
    scope: &TenantScope, q: &ListQuery) -> Document {
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
    if let Some(acc) = q.account_id.as_deref()
        && let Ok(oid) = oid_from_str(acc)
    {
        filter.insert("accountId", oid);
    }
    if let Some(k) = q.kind.as_deref()
        && VALID_KINDS.contains(&k)
    {
        filter.insert("type", k);
    }
    if let Some(c) = q.category.as_deref() {
        filter.insert("category", c);
    }
    let mut range = Document::new();
    if let Some(s) = q.from.as_deref()
        && let Ok(d) = parse_iso_date(s)
    {
        range.insert("$gte", d);
    }
    if let Some(s) = q.to.as_deref()
        && let Ok(d) = parse_iso_date(s)
    {
        range.insert("$lte", d);
    }
    if !range.is_empty() {
        filter.insert("transactionDate", range);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn entity_from_create(
    input: CreateBankTransactionInput,
    user_id: ObjectId,
) -> Result<CrmBankTransaction> {
    let account_id = oid_from_str(&input.account_id)?;
    let transaction_date = parse_iso_date(&input.transaction_date)?;
    if !input.amount.is_finite() || input.amount <= 0.0 {
        return Err(ApiError::Validation(
            "amount must be a positive number".to_owned(),
        ));
    }
    let kind = input.kind.to_lowercase();
    if !VALID_KINDS.contains(&kind.as_str()) {
        return Err(ApiError::Validation(
            "type must be 'debit' or 'credit'".to_owned(),
        ));
    }
    let status = input
        .status
        .map(|s| s.to_lowercase())
        .filter(|s| VALID_STATUSES.contains(&s.as_str()))
        .unwrap_or_else(|| "pending".to_owned());
    let voucher_entry_id = match input.voucher_entry_id.as_deref() {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(CrmBankTransaction {
        id: None,
        user_id,
        project_id: None,
        account_id,
        transaction_date,
        amount: input.amount,
        kind,
        description: input.description,
        reference_number: input.reference_number,
        balance_after: input.balance_after,
        category: input.category,
        voucher_entry_id,
        status,
        source_file_url: input.source_file_url,
        created_at: now,
        updated_at: now,
    })
}

fn build_update_doc(patch: UpdateBankTransactionInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.account_id {
        set.insert("accountId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.transaction_date {
        set.insert("transactionDate", parse_iso_date(&v)?);
    }
    if let Some(v) = patch.amount {
        if !v.is_finite() || v <= 0.0 {
            return Err(ApiError::Validation(
                "amount must be a positive number".to_owned(),
            ));
        }
        set.insert("amount", v);
    }
    if let Some(v) = patch.kind {
        let k = v.to_lowercase();
        if !VALID_KINDS.contains(&k.as_str()) {
            return Err(ApiError::Validation(
                "type must be 'debit' or 'credit'".to_owned(),
            ));
        }
        set.insert("type", k);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.reference_number {
        set.insert("referenceNumber", v);
    }
    if let Some(v) = patch.balance_after {
        set.insert("balanceAfter", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.voucher_entry_id {
        set.insert("voucherEntryId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.status {
        let s = v.to_lowercase();
        if !VALID_STATUSES.contains(&s.as_str()) {
            return Err(ApiError::Validation("invalid status".to_owned()));
        }
        set.insert("status", s);
    }
    if let Some(v) = patch.source_file_url {
        set.insert("sourceFileUrl", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmBankTransaction) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmBankTransaction>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_transactions(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["description", "referenceNumber", "category"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "transactionDate": -1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmBankTransaction>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.find")))?;
    let mut rows: Vec<CrmBankTransaction> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tx_id))]
pub async fn get_transaction(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(tx_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmBankTransaction>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&tx_id)?;
    let coll = mongo.collection::<CrmBankTransaction>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bank_transaction".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_transaction(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBankTransactionInput>,
) -> Result<Json<CreateBankTransactionResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmBankTransaction>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateBankTransactionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tx_id))]
pub async fn update_transaction(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(tx_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateBankTransactionInput>,
) -> Result<Json<CrmBankTransaction>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&tx_id)?;

    let coll = mongo.collection::<CrmBankTransaction>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bank_transaction".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bank_transaction".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.refetch")))?
        .ok_or_else(|| ApiError::NotFound("bank_transaction".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tx_id))]
pub async fn delete_transaction(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(tx_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteBankTransactionResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&tx_id)?;

    let coll = mongo.collection::<CrmBankTransaction>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bank_tx.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bank_transaction".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteBankTransactionResponse { deleted: true }))
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
    fn entity_from_create_stamps_pending_status_by_default() {
        let user_id = ObjectId::new();
        let acc = ObjectId::new();
        let input = CreateBankTransactionInput {
            account_id: acc.to_hex(),
            transaction_date: "2026-05-17".into(),
            amount: 1250.0,
            kind: "credit".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "pending");
        assert_eq!(e.kind, "credit");
        assert_eq!(e.account_id, acc);
    }

    #[test]
    fn entity_from_create_rejects_non_positive_amount() {
        let user_id = ObjectId::new();
        let acc = ObjectId::new();
        let input = CreateBankTransactionInput {
            account_id: acc.to_hex(),
            transaction_date: "2026-05-17".into(),
            amount: 0.0,
            kind: "debit".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn entity_from_create_rejects_unknown_kind() {
        let user_id = ObjectId::new();
        let acc = ObjectId::new();
        let input = CreateBankTransactionInput {
            account_id: acc.to_hex(),
            transaction_date: "2026-05-17".into(),
            amount: 100.0,
            kind: "transfer".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn list_filter_user_scope_filters_user_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), &ListQuery { status: Some("all".to_owned()), ..Default::default() });
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn list_filter_project_scope_filters_project_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), &ListQuery { status: Some("all".to_owned()), ..Default::default() });
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
