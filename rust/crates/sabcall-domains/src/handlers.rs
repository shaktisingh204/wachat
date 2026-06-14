//! HTTP handlers for the SIP domain entity.

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
    CreateDomainInput, CreateDomainResponse, DeleteDomainResponse, ListQuery, UpdateDomainInput,
};
use crate::types::SipDomain;

const COLL: &str = "sabcall_domains";
const ENTITY_KIND: &str = "voice_domain";
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

fn domain_from_create(input: CreateDomainInput, user_id: ObjectId) -> Result<SipDomain> {
    if input.domain.trim().is_empty() {
        return Err(ApiError::Validation("domain is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(SipDomain {
        id: None,
        user_id,
        domain: input.domain.trim().to_lowercase(),
        label: input
            .label
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        record_calls: input.record_calls.unwrap_or(false),
        default_application_id: input
            .default_application_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDomainInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.label {
        set.insert("label", v);
    }
    if let Some(v) = patch.record_calls {
        set.insert("recordCalls", v);
    }
    if let Some(v) = patch
        .default_application_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("defaultApplicationId", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SipDomain) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SipDomain>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_domains(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["domain", "label"]);
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
    let coll = mongo.collection::<SipDomain>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.find")))?;
    let mut rows: Vec<SipDomain> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %domain_id))]
pub async fn get_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
) -> Result<Json<SipDomain>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SipDomain>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_domain".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDomainInput>,
) -> Result<Json<CreateDomainResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = domain_from_create(input, user_id)?;
    let coll = mongo.collection::<SipDomain>(COLL);

    let existing = coll
        .find_one(doc! { "userId": user_id, "domain": &entity.domain })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.find_dup"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "a domain with this name is already provisioned".to_owned(),
        ));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.insert"))
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
    Ok(Json(CreateDomainResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %domain_id))]
pub async fn update_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
    Json(patch): Json<UpdateDomainInput>,
) -> Result<Json<SipDomain>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SipDomain>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_domain".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_domain".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_domain".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %domain_id))]
pub async fn delete_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
) -> Result<Json<DeleteDomainResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SipDomain>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_domains.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("voice_domain".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDomainResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_from_create_defaults_status_and_lowercases_domain() {
        let user_id = ObjectId::new();
        let input = CreateDomainInput {
            domain: "Acme.SIP.SabNode.Com".into(),
            ..Default::default()
        };
        let d = domain_from_create(input, user_id).unwrap();
        assert_eq!(d.status, "active");
        assert_eq!(d.domain, "acme.sip.sabnode.com");
        assert!(!d.record_calls);
    }

    #[test]
    fn domain_from_create_rejects_bad_status() {
        let user_id = ObjectId::new();
        let input = CreateDomainInput {
            domain: "acme.sip.sabnode.com".into(),
            status: Some("bogus".into()),
            ..Default::default()
        };
        assert!(domain_from_create(input, user_id).is_err());
    }
}
