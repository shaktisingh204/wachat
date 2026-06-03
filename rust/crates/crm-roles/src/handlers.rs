//! HTTP handlers for the Role entity.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateRoleInput, CreateRoleResponse, DeleteRoleResponse, ListQuery, UpdateRoleInput,
};
use crate::types::{CrmRole, RolePermissionFlags};

const COLL: &str = "crm_roles";
const ENTITY_KIND: &str = "role";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
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
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// `slug` is normalised to lowercase + hyphens. We accept an explicit
/// override on `CreateRoleInput::slug`; otherwise derive from `name`.
fn slugify(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut last_hyphen = true;
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_hyphen = false;
        } else if !last_hyphen {
            out.push('-');
            last_hyphen = true;
        }
    }
    out.trim_matches('-').to_string()
}

fn role_from_create(input: CreateRoleInput, user_id: ObjectId) -> Result<CrmRole> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let slug = input
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(input.name.trim()));
    if slug.is_empty() {
        return Err(ApiError::Validation(
            "slug could not be derived from name".to_owned(),
        ));
    }
    Ok(CrmRole {
        id: None,
        user_id,
        name: input.name.trim().to_string(),
        slug,
        display_name: input.display_name,
        description: input.description,
        is_admin: input.is_admin,
        permissions: input.permissions,
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn permissions_to_bson(perms: &BTreeMap<String, RolePermissionFlags>) -> Bson {
    let mut d = Document::new();
    for (k, v) in perms {
        if let Ok(sub) = bson::to_document(v) {
            d.insert(k, Bson::Document(sub));
        }
    }
    Bson::Document(d)
}

fn build_update_doc(patch: UpdateRoleInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.slug {
        let s = slugify(v.trim());
        if !s.is_empty() {
            set.insert("slug", s);
        }
    }
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_admin {
        set.insert("isAdmin", v);
    }
    if let Some(v) = patch.permissions {
        set.insert("permissions", permissions_to_bson(&v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmRole) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmRole>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_roles(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "displayName", "description"]);
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

    let coll = mongo.collection::<CrmRole>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.find")))?;
    let mut rows: Vec<CrmRole> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn get_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
) -> Result<Json<CrmRole>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;
    let coll = mongo.collection::<CrmRole>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRoleInput>,
) -> Result<Json<CreateRoleResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = role_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmRole>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateRoleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn update_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
    Json(patch): Json<UpdateRoleInput>,
) -> Result<Json<CrmRole>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;

    let coll = mongo.collection::<CrmRole>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("role".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.refetch")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn delete_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
) -> Result<Json<DeleteRoleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;

    let coll = mongo.collection::<CrmRole>(COLL);

    // If the persisted doc carries a `status` field we soft-delete by
    // flipping it to `"archived"`. Otherwise we hard-delete so the API
    // stays useful for older docs that pre-date the lifecycle column.
    let existing = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    if existing.status.is_some() {
        let result = coll
            .update_one(
                ownership_filter(user_id, oid),
                doc! { "$set": {
                    "status": "archived",
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                }},
            )
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.archive")))?;
        if result.matched_count == 0 {
            return Err(ApiError::NotFound("role".to_owned()));
        }
    } else {
        let result = coll
            .delete_one(ownership_filter(user_id, oid))
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_roles.delete")))?;
        if result.deleted_count == 0 {
            return Err(ApiError::NotFound("role".to_owned()));
        }
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteRoleResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_handles_spaces_and_punctuation() {
        assert_eq!(slugify("Sales Manager!"), "sales-manager");
        assert_eq!(slugify("  Lead/HR_Ops  "), "lead-hr-ops");
        assert_eq!(slugify("Admin"), "admin");
    }

    #[test]
    fn role_from_create_stamps_active_and_derives_slug() {
        let user_id = ObjectId::new();
        let input = CreateRoleInput {
            name: "Account Manager".into(),
            ..Default::default()
        };
        let r = role_from_create(input, user_id).unwrap();
        assert_eq!(r.status.as_deref(), Some("active"));
        assert_eq!(r.slug, "account-manager");
        assert!(r.permissions.is_empty());
    }

    #[test]
    fn role_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateRoleInput {
            name: "  ".into(),
            ..Default::default()
        };
        assert!(role_from_create(input, user_id).is_err());
    }

    #[test]
    fn role_from_create_keeps_permission_grid() {
        let user_id = ObjectId::new();
        let mut perms: BTreeMap<String, RolePermissionFlags> = BTreeMap::new();
        perms.insert(
            "crm_lead".into(),
            RolePermissionFlags {
                view: true,
                create: true,
                edit: false,
                delete: false,
            },
        );
        let input = CreateRoleInput {
            name: "Lead Viewer".into(),
            permissions: perms,
            ..Default::default()
        };
        let r = role_from_create(input, user_id).unwrap();
        let flags = r.permissions.get("crm_lead").unwrap();
        assert!(flags.view);
        assert!(flags.create);
        assert!(!flags.delete);
    }
}
