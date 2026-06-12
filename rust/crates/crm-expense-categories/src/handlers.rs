//! HTTP handlers for the ExpenseCategory entity.

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
    CreateExpenseCategoryInput, CreateExpenseCategoryResponse, DeleteExpenseCategoryResponse,
    ListQuery, ScopeQuery, UpdateExpenseCategoryInput,
};
use crate::types::CrmExpenseCategory;

const COLL: &str = "crm_expense_categories";
const ENTITY_KIND: &str = "expense_category";

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId` (finance-rollout gap G5).
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
    is_active: Option<bool>,
    is_billable: Option<bool>,
    is_reimbursable: Option<bool>,
    parent_id: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(active) = is_active {
        filter.insert("isActive", active);
    }
    if let Some(b) = is_billable {
        filter.insert("isBillable", b);
    }
    if let Some(r) = is_reimbursable {
        filter.insert("isReimbursable", r);
    }
    if let Some(p) = parent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if p.eq_ignore_ascii_case("none") || p.eq_ignore_ascii_case("null") {
            // Match top-level (either missing field or explicit null).
            filter.insert("parentId", doc! { "$in": [bson::Bson::Null] });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
        }
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

/// Non-archived doc with the same name for this tenant — used for unique-name
/// enforcement on create and rename.
fn duplicate_name_filter(scope: &TenantScope, name: &str, exclude: Option<ObjectId>) -> Document {
    let mut filter = scope.filter();
    filter.insert("name", name);
    filter.insert("status", doc! { "$ne": "archived" });
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    filter
}

fn category_from_create(
    input: CreateExpenseCategoryInput,
    user_id: ObjectId,
) -> Result<CrmExpenseCategory> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent = input
        .parent_id
        .as_deref()
        .map(str::trim)
        .filter(|s| {
            !s.is_empty() && !s.eq_ignore_ascii_case("none") && !s.eq_ignore_ascii_case("null")
        })
        .and_then(|s| ObjectId::parse_str(s).ok());
    let default_account = input
        .default_account_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok());
    Ok(CrmExpenseCategory {
        id: None,
        user_id,
        // Stamped by the create handler when the request arrived on a
        // project-scoped mount (finance-rollout gap G5).
        project_id: None,
        name: name.to_owned(),
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        parent_id: parent,
        description: input.description,
        default_account_id: default_account,
        tax_rate: input.tax_rate,
        is_billable: input.is_billable.unwrap_or(false),
        is_reimbursable: input.is_reimbursable.unwrap_or(true),
        max_amount: input.max_amount,
        requires_receipt_above: input.requires_receipt_above,
        color: input.color,
        icon: input.icon,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateExpenseCategoryInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let mut unset = Document::new();

    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.code {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            unset.insert("code", "");
        } else {
            set.insert("code", trimmed);
        }
    }
    if let Some(v) = patch.parent_id {
        let trimmed = v.trim();
        if trimmed.is_empty()
            || trimmed.eq_ignore_ascii_case("none")
            || trimmed.eq_ignore_ascii_case("null")
        {
            unset.insert("parentId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("parentId", oid);
        }
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.default_account_id {
        let trimmed = v.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
            unset.insert("defaultAccountId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("defaultAccountId", oid);
        }
    }
    if let Some(v) = patch.tax_rate {
        set.insert("taxRate", v);
    }
    if let Some(v) = patch.is_billable {
        set.insert("isBillable", v);
    }
    if let Some(v) = patch.is_reimbursable {
        set.insert("isReimbursable", v);
    }
    if let Some(v) = patch.max_amount {
        set.insert("maxAmount", v);
    }
    if let Some(v) = patch.requires_receipt_above {
        set.insert("requiresReceiptAbove", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }
    Ok(update)
}

fn doc_for_audit(entity: &CrmExpenseCategory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmExpenseCategory>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_categories(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.is_active,
        q.is_billable,
        q.is_reimbursable,
        q.parent_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "description"]);
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

    let coll = mongo.collection::<CrmExpenseCategory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.find"))
    })?;
    let mut rows: Vec<CrmExpenseCategory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn get_category(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmExpenseCategory>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&category_id)?;
    let coll = mongo.collection::<CrmExpenseCategory>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_category".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_category(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateExpenseCategoryInput>,
) -> Result<Json<CreateExpenseCategoryResponse>> {
    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let mut entity = category_from_create(input, user_id)?;
    // On project-scoped mounts the tenancy key is the projectId
    // (finance-rollout gap G5). `userId` still records the creator.
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }

    let coll = mongo.collection::<CrmExpenseCategory>(COLL);

    // Unique-name guard (scoped to non-archived categories for this tenant).
    let dup = coll
        .find_one(duplicate_name_filter(&scope, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "expense category '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.insert"))
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

    Ok(Json(CreateExpenseCategoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn update_category(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateExpenseCategoryInput>,
) -> Result<Json<CrmExpenseCategory>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmExpenseCategory>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_category".to_owned()))?;

    // Validate name (non-empty + unique among non-archived categories excluding self).
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name != before.name {
            let dup = coll
                .find_one(duplicate_name_filter(&scope, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("crm_expense_categories.dup_check"),
                    )
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "expense category '{new_name}' already exists"
                )));
            }
        }
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("expense_category".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_category".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %category_id))]
pub async fn delete_category(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(category_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteExpenseCategoryResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&category_id)?;

    let coll = mongo.collection::<CrmExpenseCategory>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_categories.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("expense_category".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteExpenseCategoryResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None, None, None, None);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    /// G5 — project-scoped mounts filter by `projectId`, never `userId`.
    #[test]
    fn list_filter_project_scope_filters_project_id() {
        let project = ObjectId::new();
        let f = list_filter(&TenantScope::Project(project), None, None, None, None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }

    /// G5 — ownership checks follow the tenant scope on both mounts.
    #[test]
    fn ownership_filter_matches_scope_kind() {
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
    fn category_from_create_defaults_status_billable_reimbursable() {
        let user_id = ObjectId::new();
        let input = CreateExpenseCategoryInput {
            name: "  Travel  ".into(),
            ..Default::default()
        };
        let c = category_from_create(input, user_id).unwrap();
        // Name is trimmed.
        assert_eq!(c.name, "Travel");
        assert_eq!(c.status, "active");
        assert!(c.is_active);
        // Default: not billable, but reimbursable.
        assert!(!c.is_billable);
        assert!(c.is_reimbursable);
    }

    #[test]
    fn category_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateExpenseCategoryInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(category_from_create(input, user_id).is_err());
    }

    #[test]
    fn duplicate_name_filter_scopes_to_user_and_excludes_archived() {
        let user_id = ObjectId::new();
        let f = duplicate_name_filter(&TenantScope::User(user_id), "Travel", None);
        assert_eq!(f.get_object_id("userId").unwrap(), user_id);
        assert_eq!(f.get_str("name").unwrap(), "Travel");
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
        assert!(!f.contains_key("_id"));
    }

    #[test]
    fn duplicate_name_filter_excludes_self_when_renaming() {
        let user_id = ObjectId::new();
        let self_id = ObjectId::new();
        let f = duplicate_name_filter(&TenantScope::User(user_id), "Travel", Some(self_id));
        let id_clause = f.get_document("_id").unwrap();
        assert_eq!(id_clause.get_object_id("$ne").unwrap(), self_id);
    }

    /// G5 — the unique-name guard is per-PROJECT on sabcrm mounts, so
    /// two workspaces may both have a "Travel" category.
    #[test]
    fn duplicate_name_filter_scopes_to_project_on_sabcrm_mounts() {
        let project = ObjectId::new();
        let f = duplicate_name_filter(&TenantScope::Project(project), "Travel", None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }

    /// G5 — `resolve_scope` requires `projectId` on project mounts and
    /// ignores it on legacy mounts.
    #[test]
    fn resolve_scope_modes() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let user = AuthUser {
            user_id: user_id.to_hex(),
            tenant_id: String::new(),
            roles: vec![],
        };
        // Legacy mount → userId scope, projectId ignored.
        let s = resolve_scope(ScopeMode::User, &user, Some(project_id.to_hex().as_str())).unwrap();
        assert!(matches!(s, TenantScope::User(u) if u == user_id));
        // Project mount → projectId scope, required.
        let s =
            resolve_scope(ScopeMode::Project, &user, Some(project_id.to_hex().as_str())).unwrap();
        assert!(matches!(s, TenantScope::Project(p) if p == project_id));
        assert!(resolve_scope(ScopeMode::Project, &user, None).is_err());
        assert!(resolve_scope(ScopeMode::Project, &user, Some("garbage")).is_err());
    }

    /// G5 — legacy documents (no `projectId`) deserialize unchanged;
    /// project-stamped documents round-trip the camelCase `projectId`
    /// key through BSON the same way the Mongo driver will.
    #[test]
    fn entity_project_id_serde_round_trip() {
        let legacy = doc! {
            "userId": ObjectId::new(),
            "name": "Travel",
            "status": "active",
            "createdAt": BsonDateTime::from_chrono(Utc::now()),
        };
        let cat: CrmExpenseCategory = bson::from_document(legacy).unwrap();
        assert!(cat.project_id.is_none());
        // Legacy docs never serialize a `projectId` key back out.
        let out = bson::to_document(&cat).unwrap();
        assert!(!out.contains_key("projectId"));

        let project = ObjectId::new();
        let with_project = CrmExpenseCategory {
            project_id: Some(project),
            ..cat
        };
        let out = bson::to_document(&with_project).unwrap();
        assert_eq!(out.get_object_id("projectId").unwrap(), project);
        let back: CrmExpenseCategory = bson::from_document(out).unwrap();
        assert_eq!(back.project_id, Some(project));
    }
}
