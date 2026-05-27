use axum::{Json, extract::{Path, Query, State}, http::StatusCode};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::DOMAINS_COLL;
use crate::dto::{CreateDomainBody, ListDomainsQuery, ListDomainsResponse, UpdateDomainBody};
use crate::state::SabcatalystDomainsState;
use crate::types::SslStatus;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_domains(
    user: AuthUser, State(state): State<SabcatalystDomainsState>, Query(q): Query<ListDomainsQuery>,
) -> Result<Json<ListDomainsResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(100).build();
    let cur = state.mongo.collection::<Document>(DOMAINS_COLL)
        .find(doc! { "userId": owner, "projectId": project }).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.collect")))?;
    Ok(Json(ListDomainsResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

#[instrument(skip_all)]
pub async fn create_domain(
    user: AuthUser, State(state): State<SabcatalystDomainsState>,
    Json(body): Json<CreateDomainBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.hostname.trim().is_empty() {
        return Err(ApiError::BadRequest("hostname required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let coll = state.mongo.collection::<Document>(DOMAINS_COLL);
    let dup = coll.find_one(doc! { "hostname": &body.hostname }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.dup")))?;
    if dup.is_some() { return Err(ApiError::Conflict("hostname already registered".into())); }
    let now = Utc::now();
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project,
        "hostname": body.hostname.trim().to_lowercase(),
        "verified": false,
        "sslStatus": "pending",
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    coll.insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn update_domain(
    user: AuthUser, State(state): State<SabcatalystDomainsState>, Path(id): Path<String>,
    Json(body): Json<UpdateDomainBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = body.verified { set.insert("verified", v); }
    if let Some(v) = body.ssl_status {
        if let Ok(b) = to_bson(&v) { set.insert("sslStatus", b); }
    }
    let d = state.mongo.collection::<Document>(DOMAINS_COLL)
        .find_one_and_update(doc! { "_id": oid, "userId": owner }, doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.update")))?
        .ok_or_else(|| ApiError::NotFound("Domain not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn delete_domain(
    user: AuthUser, State(state): State<SabcatalystDomainsState>, Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state.mongo.collection::<Document>(DOMAINS_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("domains.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("Domain not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}
