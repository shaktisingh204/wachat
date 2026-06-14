//! HTTP handlers for the Voice SIP ACL entity.

use axum::{
    Json,
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
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateAclInput, CreateAclResponse, DeleteAclResponse, ListQuery, UpdateAclInput,
};
use crate::types::SipAcl;

const COLL: &str = "sabcall_acls";
const ENTITY_KIND: &str = "voice_acl";
const VALID_STATUSES: &[&str] = &["active", "disabled"];
const VALID_ACTIONS: &[&str] = &["allow", "deny"];
const VALID_APPLIES_TO: &[&str] = &["trunk", "registration", "all"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = status.map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    filter
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUSES.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUSES:?}"
        )))
    }
}

fn validate_action(a: &str) -> Result<()> {
    if VALID_ACTIONS.contains(&a) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "action must be one of {VALID_ACTIONS:?}"
        )))
    }
}

fn validate_applies_to(a: &str) -> Result<()> {
    if VALID_APPLIES_TO.contains(&a) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "appliesTo must be one of {VALID_APPLIES_TO:?}"
        )))
    }
}

fn acl_from_create(input: CreateAclInput, user_id: ObjectId) -> Result<SipAcl> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let cidrs: Vec<String> = input
        .cidrs
        .into_iter()
        .map(|c| c.trim().to_owned())
        .filter(|c| !c.is_empty())
        .collect();
    if cidrs.is_empty() {
        return Err(ApiError::Validation(
            "at least one cidr is required".to_owned(),
        ));
    }
    let action = input.action.unwrap_or_else(|| "allow".to_owned());
    validate_action(&action)?;
    let applies_to = input.applies_to.unwrap_or_else(|| "all".to_owned());
    validate_applies_to(&applies_to)?;
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(SipAcl {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        action,
        cidrs,
        applies_to,
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAclInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim().to_owned());
    }
    if let Some(v) = patch.action {
        validate_action(&v)?;
        set.insert("action", v);
    }
    if let Some(v) = patch.cidrs {
        set.insert("cidrs", v);
    }
    if let Some(v) = patch.applies_to {
        validate_applies_to(&v)?;
        set.insert("appliesTo", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SipAcl) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SipAcl>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_acls(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
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
    let coll = mongo.collection::<SipAcl>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.find")))?;
    let mut rows: Vec<SipAcl> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %acl_id))]
pub async fn get_acl(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(acl_id): Path<String>,
) -> Result<Json<SipAcl>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&acl_id)?;
    let coll = mongo.collection::<SipAcl>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_acl".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_acl(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAclInput>,
) -> Result<Json<CreateAclResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = acl_from_create(input, user_id)?;
    let coll = mongo.collection::<SipAcl>(COLL);

    let existing = coll
        .find_one(doc! { "userId": user_id, "name": &entity.name })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.find_dup")))?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "an ACL with this name already exists".to_owned(),
        ));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateAclResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %acl_id))]
pub async fn update_acl(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(acl_id): Path<String>,
    Json(patch): Json<UpdateAclInput>,
) -> Result<Json<SipAcl>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&acl_id)?;
    let coll = mongo.collection::<SipAcl>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_acl".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_acl".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voice_acl".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %acl_id))]
pub async fn delete_acl(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(acl_id): Path<String>,
) -> Result<Json<DeleteAclResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&acl_id)?;
    let coll = mongo.collection::<SipAcl>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_acls.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("voice_acl".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAclResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acl_from_create_defaults_action_applies_to_and_status() {
        let user_id = ObjectId::new();
        let input = CreateAclInput {
            name: "office".into(),
            cidrs: vec!["10.0.0.0/8".into()],
            ..Default::default()
        };
        let a = acl_from_create(input, user_id).unwrap();
        assert_eq!(a.action, "allow");
        assert_eq!(a.applies_to, "all");
        assert_eq!(a.status, "active");
        assert_eq!(a.cidrs, vec!["10.0.0.0/8".to_owned()]);
    }

    #[test]
    fn acl_from_create_rejects_empty_cidrs() {
        let user_id = ObjectId::new();
        let input = CreateAclInput {
            name: "office".into(),
            cidrs: vec![],
            ..Default::default()
        };
        assert!(acl_from_create(input, user_id).is_err());
    }
}
