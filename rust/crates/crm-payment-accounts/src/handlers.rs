//! HTTP handlers for the Payment Account entity.

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
    CreateAccountInput, CreateAccountResponse, DeleteAccountResponse, ListQuery, ScopeQuery,
    UpdateAccountInput,
};
use crate::types::CrmPaymentAccount;

const COLL: &str = "crm_payment_accounts";
const ENTITY_KIND: &str = "payment_account";

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId`.
fn resolve_scope(mode: ScopeMode, user: &AuthUser, project_id: Option<&str>) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

fn list_filter(scope: &TenantScope, status: Option<&str>, account_type: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "inactive" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = account_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("accountType", t);
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

fn account_from_create(input: CreateAccountInput, user_id: ObjectId) -> Result<CrmPaymentAccount> {
    if input.account_name.trim().is_empty() {
        return Err(ApiError::Validation("accountName is required".to_owned()));
    }
    if input.account_type.trim().is_empty() {
        return Err(ApiError::Validation("accountType is required".to_owned()));
    }
    Ok(CrmPaymentAccount {
        id: None,
        user_id,
        project_id: None,
        account_name: input.account_name.trim().to_owned(),
        account_type: input.account_type.trim().to_owned(),
        status: "active".to_owned(),
        opening_balance: input.opening_balance.unwrap_or(0.0),
        opening_balance_date: input
            .opening_balance_date
            .as_deref()
            .and_then(parse_date)
            .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now())),
        currency: Some(input.currency.unwrap_or_else(|| "INR".to_owned())),
        is_default: input.is_default.unwrap_or(false),
        bank_details: input.bank_details,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAccountInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.account_name {
        set.insert("accountName", v);
    }
    if let Some(v) = patch.account_type {
        set.insert("accountType", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.opening_balance {
        set.insert("openingBalance", v);
    }
    if let Some(v) = patch.opening_balance_date.as_deref().and_then(parse_date) {
        set.insert("openingBalanceDate", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.bank_details {
        if let Ok(d) = bson::to_document(&v) {
            set.insert("bankDetails", d);
        }
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPaymentAccount) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPaymentAccount>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_accounts(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref(), q.account_type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["accountName"]);
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
    let coll = mongo.collection::<CrmPaymentAccount>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.find"))
    })?;
    let mut rows: Vec<CrmPaymentAccount> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %account_id))]
pub async fn get_account(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmPaymentAccount>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<CrmPaymentAccount>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payment_account".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_account(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAccountInput>,
) -> Result<Json<CreateAccountResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity field);
    // `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = account_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmPaymentAccount>(COLL);
    if entity.is_default {
        let mut default_filter = scope.filter();
        default_filter.insert("isDefault", true);
        let _ = coll
            .update_many(default_filter, doc! { "$set": { "isDefault": false } })
            .await;
    }
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.insert"))
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
    Ok(Json(CreateAccountResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %account_id))]
pub async fn update_account(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateAccountInput>,
) -> Result<Json<CrmPaymentAccount>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<CrmPaymentAccount>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payment_account".to_owned()))?;
    if matches!(patch.is_default, Some(true)) {
        let mut default_filter = scope.filter();
        default_filter.insert("isDefault", true);
        default_filter.insert("_id", doc! { "$ne": oid });
        let _ = coll
            .update_many(default_filter, doc! { "$set": { "isDefault": false } })
            .await;
    }
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payment_account".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("payment_account".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %account_id))]
pub async fn delete_account(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteAccountResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<CrmPaymentAccount>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_accounts.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payment_account".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAccountResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None);
        assert!(f.contains_key("status"));
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
        let f = list_filter(&TenantScope::Project(oid), Some("all"), Some("bank"));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        assert_eq!(f.get_str("accountType").unwrap(), "bank");
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

    #[test]
    fn account_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            account_name: "HDFC Current".into(),
            account_type: "bank".into(),
            ..Default::default()
        };
        let a = account_from_create(input, user_id).unwrap();
        assert_eq!(a.status, "active");
        assert_eq!(a.currency.as_deref(), Some("INR"));
        assert_eq!(a.opening_balance, 0.0);
    }

    #[test]
    fn account_from_create_rejects_missing_type() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            account_name: "X".into(),
            account_type: "".into(),
            ..Default::default()
        };
        assert!(account_from_create(input, user_id).is_err());
    }
}
