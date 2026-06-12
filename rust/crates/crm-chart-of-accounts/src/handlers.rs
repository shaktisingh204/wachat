//! HTTP handlers for the Chart of Account entity.

use axum::{
    Extension, Json,
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
use crate::types::CrmChartOfAccount;

const COLL: &str = "crm_chart_of_accounts";
const ENTITY_KIND: &str = "chart_of_account";

const ALLOWED_TYPES: &[&str] = &["asset", "liability", "income", "expense", "equity"];

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
    account_type: Option<&str>,
    account_group_id: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
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
    if let Some(t) = account_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("accountType", t);
    }
    if let Some(gid) = account_group_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("accountGroupId", gid);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn normalize_type(t: &str) -> Option<String> {
    let lower = t.trim().to_lowercase();
    if ALLOWED_TYPES.contains(&lower.as_str()) {
        Some(lower)
    } else {
        None
    }
}

fn account_from_create(input: CreateAccountInput, user_id: ObjectId) -> Result<CrmChartOfAccount> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let account_type = match input.account_type.as_deref() {
        Some(t) if !t.trim().is_empty() => Some(
            normalize_type(t)
                .ok_or_else(|| ApiError::Validation("invalid accountType".to_owned()))?,
        ),
        _ => None,
    };
    Ok(CrmChartOfAccount {
        id: None,
        user_id,
        project_id: None,
        name: name.to_owned(),
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        account_group_id: input
            .account_group_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        account_type,
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        opening_balance: input.opening_balance,
        currency: input
            .currency
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAccountInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch
        .account_group_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("accountGroupId", v);
    }
    if let Some(v) = patch.account_type.as_deref() {
        if !v.trim().is_empty() {
            let normalized = normalize_type(v)
                .ok_or_else(|| ApiError::Validation("invalid accountType".to_owned()))?;
            set.insert("accountType", normalized);
        }
    }
    if let Some(v) = patch
        .parent_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentId", v);
    }
    if let Some(v) = patch.opening_balance {
        set.insert("openingBalance", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmChartOfAccount) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmChartOfAccount>,
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
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.account_type.as_deref(),
        q.account_group_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "notes"]);
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
    let coll = mongo.collection::<CrmChartOfAccount>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.find"))
    })?;
    let mut rows: Vec<CrmChartOfAccount> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.collect"))
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
) -> Result<Json<CrmChartOfAccount>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<CrmChartOfAccount>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
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
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = account_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmChartOfAccount>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.insert"))
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
) -> Result<Json<CrmChartOfAccount>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<CrmChartOfAccount>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(ENTITY_KIND.to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
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
    let coll = mongo.collection::<CrmChartOfAccount>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_chart_of_accounts.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(ENTITY_KIND.to_owned()));
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
        let f = list_filter(&TenantScope::User(oid), None, None, None);
        assert!(f.contains_key("status"));
        let status = f.get("status").unwrap();
        // default is `{ "$ne": "archived" }`, not a plain string.
        assert!(status.as_document().is_some());
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None, None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn account_from_create_defaults_and_trims() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            name: "  Cash in Hand  ".into(),
            ..Default::default()
        };
        let a = account_from_create(input, user_id).unwrap();
        assert_eq!(a.name, "Cash in Hand");
        assert_eq!(a.status, "active");
        assert_eq!(a.is_active, true);
        assert!(a.account_type.is_none());
    }

    #[test]
    fn account_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(account_from_create(input, user_id).is_err());
    }

    #[test]
    fn account_from_create_rejects_bad_type() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            name: "Sales".into(),
            account_type: Some("bogus".into()),
            ..Default::default()
        };
        assert!(account_from_create(input, user_id).is_err());
    }

    #[test]
    fn account_from_create_normalizes_type_case() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            name: "Sales".into(),
            account_type: Some("INCOME".into()),
            ..Default::default()
        };
        let a = account_from_create(input, user_id).unwrap();
        assert_eq!(a.account_type.as_deref(), Some("income"));
    }
}
