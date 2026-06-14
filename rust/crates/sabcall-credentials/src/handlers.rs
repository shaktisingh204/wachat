//! HTTP handlers for the SIP credential entity.

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
    CreateCredentialInput, CreateCredentialResponse, DeleteCredentialResponse, ListQuery,
    UpdateCredentialInput,
};
use crate::types::SipCredential;

const COLL: &str = "sabcall_credentials";
const ENTITY_KIND: &str = "voice_credential";
const VALID_STATUSES: &[&str] = &["active", "disabled"];

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

fn credential_from_create(
    input: CreateCredentialInput,
    user_id: ObjectId,
) -> Result<SipCredential> {
    if input.username.trim().is_empty() {
        return Err(ApiError::Validation("username is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(SipCredential {
        id: None,
        user_id,
        username: input.username.trim().to_owned(),
        password_ref: input.password_ref,
        domain_id: input
            .domain_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        label: input
            .label
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        agent_user_id: input
            .agent_user_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        codecs: input
            .codecs
            .unwrap_or_else(|| vec!["opus".to_owned(), "ulaw".to_owned()]),
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCredentialInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.password_ref {
        set.insert("passwordRef", v);
    }
    if let Some(v) = patch
        .domain_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("domainId", v);
    }
    if let Some(v) = patch.label {
        set.insert("label", v);
    }
    if let Some(v) = patch
        .agent_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("agentUserId", v);
    }
    if let Some(v) = patch.codecs {
        set.insert("codecs", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SipCredential) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SipCredential>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_credentials(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["username", "label"]);
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
    let coll = mongo.collection::<SipCredential>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.find"))
        })?;
    let mut rows: Vec<SipCredential> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %credential_id))]
pub async fn get_credential(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(credential_id): Path<String>,
) -> Result<Json<SipCredential>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&credential_id)?;
    let coll = mongo.collection::<SipCredential>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_credential".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_credential(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCredentialInput>,
) -> Result<Json<CreateCredentialResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = credential_from_create(input, user_id)?;
    let coll = mongo.collection::<SipCredential>(COLL);

    let existing = coll
        .find_one(doc! { "userId": user_id, "username": &entity.username })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.find_dup"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "a credential with this username already exists".to_owned(),
        ));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.insert"))
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
    Ok(Json(CreateCredentialResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %credential_id))]
pub async fn update_credential(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(credential_id): Path<String>,
    Json(patch): Json<UpdateCredentialInput>,
) -> Result<Json<SipCredential>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&credential_id)?;
    let coll = mongo.collection::<SipCredential>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_credential".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_credential".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_credential".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %credential_id))]
pub async fn delete_credential(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(credential_id): Path<String>,
) -> Result<Json<DeleteCredentialResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&credential_id)?;
    let coll = mongo.collection::<SipCredential>(COLL);
    // Soft-disable: flip status to "disabled" rather than dropping the doc
    // so that historical CDRs can still reference the credential.
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "disabled",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_credentials.disable"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_credential".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCredentialResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_from_create_defaults_status_and_codecs() {
        let user_id = ObjectId::new();
        let input = CreateCredentialInput {
            username: "agent-101".into(),
            ..Default::default()
        };
        let c = credential_from_create(input, user_id).unwrap();
        assert_eq!(c.status, "active");
        assert_eq!(c.username, "agent-101");
        assert_eq!(c.codecs, vec!["opus".to_owned(), "ulaw".to_owned()]);
    }

    #[test]
    fn credential_from_create_rejects_bad_status() {
        let user_id = ObjectId::new();
        let input = CreateCredentialInput {
            username: "agent-101".into(),
            status: Some("bogus".into()),
            ..Default::default()
        };
        assert!(credential_from_create(input, user_id).is_err());
    }
}
