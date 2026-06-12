//! HTTP handlers for the Voucher Book entity.

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
    CreateBookInput, CreateBookResponse, DeleteBookResponse, ListQuery, UpdateBookInput,
};
use crate::dto::ScopeQuery;
use crate::types::CrmVoucherBook;

const COLL: &str = "crm_voucher_books";
const ENTITY_KIND: &str = "voucher_book";

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
    scope: &TenantScope, status: Option<&str>, r#type: Option<&str>) -> Document {
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
    if let Some(t) = r#type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", t);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn book_from_create(input: CreateBookInput, user_id: ObjectId) -> Result<CrmVoucherBook> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.r#type.trim().is_empty() {
        return Err(ApiError::Validation("type is required".to_owned()));
    }
    Ok(CrmVoucherBook {
        id: None,
        user_id,
        project_id: None,
        name: input.name.trim().to_owned(),
        r#type: input.r#type.trim().to_owned(),
        is_default: input.is_default.unwrap_or(false),
        prefix: input.prefix,
        suffix: input.suffix,
        starting_number: input.starting_number.map(|n| n.max(0)),
        padding: input.padding.map(|p| p.max(0)),
        reset_frequency: Some(input.reset_frequency.unwrap_or_else(|| "none".to_owned())),
        approval_required: input.approval_required.unwrap_or(false),
        is_active: input.is_active.unwrap_or(true),
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateBookInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.r#type {
        set.insert("type", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.prefix {
        set.insert("prefix", v);
    }
    if let Some(v) = patch.suffix {
        set.insert("suffix", v);
    }
    if let Some(v) = patch.starting_number {
        set.insert("startingNumber", v.max(0));
    }
    if let Some(v) = patch.padding {
        set.insert("padding", v.max(0));
    }
    if let Some(v) = patch.reset_frequency {
        set.insert("resetFrequency", v);
    }
    if let Some(v) = patch.approval_required {
        set.insert("approvalRequired", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmVoucherBook) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmVoucherBook>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_books(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope, q.status.as_deref(), q.r#type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "prefix", "suffix"]);
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
    let coll = mongo.collection::<CrmVoucherBook>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.find"))
        })?;
    let mut rows: Vec<CrmVoucherBook> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %book_id))]
pub async fn get_book(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(book_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmVoucherBook>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&book_id)?;
    let coll = mongo.collection::<CrmVoucherBook>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_book".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_book(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBookInput>,
) -> Result<Json<CreateBookResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = book_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmVoucherBook>(COLL);
    if entity.is_default {
        // Demote other defaults of the same type for this tenant.
        let _ = coll
            .update_many(
                {
                    let mut f = scope.filter();
                    f.insert("type", &entity.r#type);
                    f.insert("isDefault", true);
                    f
                },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.insert"))
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
    Ok(Json(CreateBookResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %book_id))]
pub async fn update_book(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(book_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateBookInput>,
) -> Result<Json<CrmVoucherBook>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&book_id)?;
    let coll = mongo.collection::<CrmVoucherBook>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_book".to_owned()))?;
    if matches!(patch.is_default, Some(true)) {
        let demote_type = patch
            .r#type
            .clone()
            .unwrap_or_else(|| before.r#type.clone());
        let _ = coll
            .update_many(
                {
                    let mut f = scope.filter();
                    f.insert("type", demote_type);
                    f.insert("isDefault", true);
                    f.insert("_id", doc! { "$ne": oid });
                    f
                },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voucher_book".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voucher_book".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %book_id))]
pub async fn delete_book(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(book_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteBookResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&book_id)?;
    let coll = mongo.collection::<CrmVoucherBook>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_voucher_books.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voucher_book".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteBookResponse { deleted: true }))
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
    fn book_from_create_seeds_defaults() {
        let user_id = ObjectId::new();
        let input = CreateBookInput {
            name: "Sales Receipt Book".into(),
            r#type: "receipt".into(),
            ..Default::default()
        };
        let b = book_from_create(input, user_id).unwrap();
        assert_eq!(b.status.as_deref(), Some("active"));
        assert_eq!(b.reset_frequency.as_deref(), Some("none"));
        assert!(b.is_active);
        assert!(!b.is_default);
    }

    #[test]
    fn book_from_create_rejects_missing_name() {
        let user_id = ObjectId::new();
        let input = CreateBookInput {
            name: "".into(),
            r#type: "receipt".into(),
            ..Default::default()
        };
        assert!(book_from_create(input, user_id).is_err());
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
