//! HTTP handlers for the Portal User entity.

use axum::{
    Json,
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
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePortalUserInput, CreatePortalUserResponse, DeletePortalUserResponse, ListQuery,
    UpdatePortalUserInput,
};
use crate::types::CrmPortalUser;

const COLL: &str = "crm_portal_users";
const ENTITY_KIND: &str = "portal_user";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    role: Option<&str>,
    contact_id: Option<&str>,
    account_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "disabled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(r) = role.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("role", r);
    }
    if let Some(cid) = contact_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("contactId", cid);
    }
    if let Some(aid) = account_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("accountId", aid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn portal_user_from_create(
    input: CreatePortalUserInput,
    user_id: ObjectId,
) -> Result<CrmPortalUser> {
    let email = input.email.trim().to_owned();
    if email.is_empty() {
        return Err(ApiError::Validation("email is required".to_owned()));
    }
    let name = input.name.trim().to_owned();
    Ok(CrmPortalUser {
        id: None,
        user_id,
        name,
        email,
        contact_id: input
            .contact_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        account_id: input
            .account_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        role: input.role.unwrap_or_else(|| "viewer".to_owned()),
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        last_login_at: None,
        invite_sent_at: input.invite_sent_at.as_deref().and_then(parse_date),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePortalUserInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.email {
        set.insert("email", v);
    }
    if let Some(v) = patch
        .contact_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("contactId", v);
    }
    if let Some(v) = patch
        .account_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("accountId", v);
    }
    if let Some(v) = patch.role {
        set.insert("role", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.last_login_at.as_deref().and_then(parse_date) {
        set.insert("lastLoginAt", v);
    }
    if let Some(v) = patch.invite_sent_at.as_deref().and_then(parse_date) {
        set.insert("inviteSentAt", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPortalUser) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPortalUser>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_portal_users(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.role.as_deref(),
        q.contact_id.as_deref(),
        q.account_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "email"]);
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
    let coll = mongo.collection::<CrmPortalUser>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.find"))
        })?;
    let mut rows: Vec<CrmPortalUser> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %portal_user_id))]
pub async fn get_portal_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(portal_user_id): Path<String>,
) -> Result<Json<CrmPortalUser>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&portal_user_id)?;
    let coll = mongo.collection::<CrmPortalUser>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("portal_user".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_portal_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePortalUserInput>,
) -> Result<Json<CreatePortalUserResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = portal_user_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPortalUser>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.insert"))
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
    Ok(Json(CreatePortalUserResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %portal_user_id))]
pub async fn update_portal_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(portal_user_id): Path<String>,
    Json(patch): Json<UpdatePortalUserInput>,
) -> Result<Json<CrmPortalUser>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&portal_user_id)?;
    let coll = mongo.collection::<CrmPortalUser>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("portal_user".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("portal_user".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.refetch")))?
        .ok_or_else(|| ApiError::NotFound("portal_user".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %portal_user_id))]
pub async fn delete_portal_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(portal_user_id): Path<String>,
) -> Result<Json<DeletePortalUserResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&portal_user_id)?;
    let coll = mongo.collection::<CrmPortalUser>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_portal_users.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("portal_user".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePortalUserResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn portal_user_from_create_defaults_role_and_status() {
        let user_id = ObjectId::new();
        let input = CreatePortalUserInput {
            name: "Jane Customer".into(),
            email: "jane@example.com".into(),
            ..Default::default()
        };
        let u = portal_user_from_create(input, user_id).unwrap();
        assert_eq!(u.role, "viewer");
        assert_eq!(u.status, "active");
        assert!(u.last_login_at.is_none());
    }

    #[test]
    fn portal_user_from_create_rejects_empty_email() {
        let user_id = ObjectId::new();
        let input = CreatePortalUserInput {
            name: "Jane Customer".into(),
            email: "   ".into(),
            ..Default::default()
        };
        assert!(portal_user_from_create(input, user_id).is_err());
    }
}
