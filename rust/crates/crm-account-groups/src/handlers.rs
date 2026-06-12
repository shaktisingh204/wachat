//! HTTP handlers for the Account Group entity.

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
    CreateGroupInput, CreateGroupResponse, DeleteGroupResponse, ListQuery, ScopeQuery,
    UpdateGroupInput,
};
use crate::types::CrmAccountGroup;

const COLL: &str = "crm_account_groups";
const ENTITY_KIND: &str = "account_group";

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
    nature: Option<&str>,
    parent_group_id: Option<&str>,
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
    if let Some(n) = nature.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("nature", n);
    }
    if let Some(p) = parent_group_id.map(str::trim).filter(|s| !s.is_empty()) {
        if p.eq_ignore_ascii_case("none") || p == "null" {
            // Match either missing field or explicit null.
            filter.insert("parentGroupId", doc! { "$in": [bson::Bson::Null] });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentGroupId", oid);
        }
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn group_from_create(input: CreateGroupInput, user_id: ObjectId) -> Result<CrmAccountGroup> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent = input
        .parent_group_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("none"))
        .and_then(|s| ObjectId::parse_str(s).ok());
    Ok(CrmAccountGroup {
        id: None,
        user_id,
        project_id: None,
        name,
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        nature: input
            .nature
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty()),
        parent_group_id: parent,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateGroupInput) -> Result<Document> {
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
    if let Some(v) = patch.nature {
        let trimmed = v.trim().to_lowercase();
        if trimmed.is_empty() {
            unset.insert("nature", "");
        } else {
            set.insert("nature", trimmed);
        }
    }
    if let Some(v) = patch.parent_group_id {
        let trimmed = v.trim();
        if trimmed.is_empty()
            || trimmed.eq_ignore_ascii_case("none")
            || trimmed.eq_ignore_ascii_case("null")
        {
            unset.insert("parentGroupId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("parentGroupId", oid);
        }
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

fn doc_for_audit(entity: &CrmAccountGroup) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAccountGroup>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_groups(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.nature.as_deref(),
        q.parent_group_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code"]);
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
    let coll = mongo.collection::<CrmAccountGroup>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.find"))
    })?;
    let mut rows: Vec<CrmAccountGroup> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn get_group(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmAccountGroup>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAccountGroup>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("account_group".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_group(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGroupInput>,
) -> Result<Json<CreateGroupResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = group_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmAccountGroup>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.insert"))
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
    Ok(Json(CreateGroupResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn update_group(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateGroupInput>,
) -> Result<Json<CrmAccountGroup>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAccountGroup>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("account_group".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("account_group".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("account_group".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn delete_group(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteGroupResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAccountGroup>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_account_groups.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("account_group".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteGroupResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None, None);
        assert!(f.contains_key("status"));
        // Default branch should be a `$ne: "archived"` predicate, not a hardcoded value.
        let status = f.get("status").unwrap();
        assert!(status.as_document().is_some(), "status should be a $ne doc");
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None, None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn group_from_create_defaults_status_and_is_active() {
        let user_id = ObjectId::new();
        let input = CreateGroupInput {
            name: "Current Assets".into(),
            nature: Some("ASSET".into()),
            ..Default::default()
        };
        let g = group_from_create(input, user_id).unwrap();
        assert_eq!(g.status, "active");
        assert!(g.is_active);
        // Nature should be lower-cased.
        assert_eq!(g.nature.as_deref(), Some("asset"));
    }

    #[test]
    fn group_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateGroupInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(group_from_create(input, user_id).is_err());
    }
}
