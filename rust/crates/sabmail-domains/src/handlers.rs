//! HTTP handlers for the SabMail domain entity.
//!
//! Tenancy: every query scoped by `userId == AuthUser.user_id`.
//! Audit: best-effort row in `crm_audit_log`.

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
use crate::types::SabmailDomain;

const COLL: &str = "sabmail_domains";
const ENTITY_KIND: &str = "sabmail_domain";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
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

fn domain_from_create(input: CreateDomainInput, user_id: ObjectId) -> SabmailDomain {
    SabmailDomain {
        id: None,
        user_id,
        owner_user_id: user_id,
        domain: input.domain.trim().to_lowercase(),
        mx_status: Some("pending".to_owned()),
        spf_status: Some("pending".to_owned()),
        dmarc_status: Some("pending".to_owned()),
        dkim_selector: None,
        dkim_public_key: None,
        dkim_status: Some("pending".to_owned()),
        mailbox_quota: input.mailbox_quota,
        mailbox_count: Some(0),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateDomainInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.mx_status {
        set.insert("mxStatus", v);
    }
    if let Some(v) = patch.spf_status {
        set.insert("spfStatus", v);
    }
    if let Some(v) = patch.dmarc_status {
        set.insert("dmarcStatus", v);
    }
    if let Some(v) = patch.dkim_selector {
        set.insert("dkimSelector", v);
    }
    if let Some(v) = patch.dkim_public_key {
        set.insert("dkimPublicKey", v);
    }
    if let Some(v) = patch.dkim_status {
        set.insert("dkimStatus", v);
    }
    if let Some(v) = patch.mailbox_quota {
        set.insert("mailboxQuota", v as i64);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(d: &SabmailDomain) -> Document {
    bson::to_document(d).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabmailDomain>,
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
        let or = build_q_filter(needle, &["domain"]);
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

    let coll = mongo.collection::<SabmailDomain>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.find"))
        })?;
    let mut rows: Vec<SabmailDomain> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, domain_id = %domain_id))]
pub async fn get_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
) -> Result<Json<SabmailDomain>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SabmailDomain>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_domain".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDomainInput>,
) -> Result<Json<CreateDomainResponse>> {
    let user_id = user_oid(&user)?;
    if input.domain.trim().is_empty() {
        return Err(ApiError::Validation("domain is required".to_owned()));
    }
    let mut entity = domain_from_create(input, user_id);
    let coll = mongo.collection::<SabmailDomain>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateDomainResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, domain_id = %domain_id))]
pub async fn update_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
    Json(patch): Json<UpdateDomainInput>,
) -> Result<Json<SabmailDomain>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SabmailDomain>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_domain".to_owned()))?;

    coll.update_one(ownership_filter(user_id, oid), build_update_doc(patch))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.update")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_domain".to_owned()))?;

    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, domain_id = %domain_id))]
pub async fn delete_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
) -> Result<Json<DeleteDomainResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let coll = mongo.collection::<SabmailDomain>(COLL);
    let res = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_domains.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabmail_domain".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteDomainResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_stamps_pending_statuses() {
        let uid = ObjectId::new();
        let d = domain_from_create(
            CreateDomainInput {
                domain: "ACME.com".into(),
                mailbox_quota: Some(50),
            },
            uid,
        );
        assert_eq!(d.domain, "acme.com");
        assert_eq!(d.mx_status.as_deref(), Some("pending"));
        assert_eq!(d.dkim_status.as_deref(), Some("pending"));
        assert_eq!(d.status.as_deref(), Some("active"));
        assert_eq!(d.user_id, uid);
        assert_eq!(d.owner_user_id, uid);
    }

    #[test]
    fn list_filter_archived_match() {
        let f = list_filter(ObjectId::new(), Some("archived"));
        assert_eq!(f.get_str("status").unwrap(), "archived");
    }
}
