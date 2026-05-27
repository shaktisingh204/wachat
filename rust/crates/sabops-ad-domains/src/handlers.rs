use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{search::build_q_filter, tenant::user_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateDomainInput, CreateDomainResponse, DeleteDomainResponse, ListQuery, SyncDomainResponse,
    UpdateDomainInput,
};
use crate::types::SabopsAdDomain;

const COLL: &str = "sabops_ad_domains";
const VALID_DIRECTION: &[&str] = &["pull_only", "two_way"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsAdDomain>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_domains(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "controllerHost"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).limit(200).build();
    let coll = mongo.collection::<SabopsAdDomain>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.find")))?;
    let rows: Vec<SabopsAdDomain> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDomainInput>,
) -> Result<Json<CreateDomainResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() || input.controller_host.trim().is_empty() {
        return Err(ApiError::Validation(
            "name and controllerHost are required".to_owned(),
        ));
    }
    if !VALID_DIRECTION.contains(&input.sync_direction.as_str()) {
        return Err(ApiError::Validation(format!(
            "syncDirection must be one of {:?}",
            VALID_DIRECTION
        )));
    }
    let mut entity = SabopsAdDomain {
        id: None,
        user_id,
        name: input.name,
        controller_host: input.controller_host,
        status: "connected".to_owned(),
        last_sync_at: None,
        sync_direction: input.sync_direction,
        last_error: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabopsAdDomain>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
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
) -> Result<Json<SabopsAdDomain>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.controller_host {
        set.insert("controllerHost", v);
    }
    if let Some(v) = patch.sync_direction {
        if !VALID_DIRECTION.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid syncDirection".to_owned()));
        }
        set.insert("syncDirection", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let coll = mongo.collection::<SabopsAdDomain>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("domain".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("domain".to_owned()))?;
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
    let coll = mongo.collection::<SabopsAdDomain>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.delete"))
        })?;
    Ok(Json(DeleteDomainResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Stamp `lastSyncAt = now()` and return the new snapshot. The real LDAP
/// pull is dispatched by the Next.js Server Action that wraps this call
/// — Rust handles only the bookkeeping.
#[instrument(skip_all, fields(user_id = %user.user_id, domain_id = %domain_id))]
pub async fn sync_domain(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(domain_id): Path<String>,
) -> Result<Json<SyncDomainResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&domain_id)?;
    let now = Utc::now();
    let coll = mongo.collection::<SabopsAdDomain>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": {
                    "lastSyncAt": BsonDateTime::from_chrono(now),
                    "status": "connected",
                    "lastError": null,
                    "updatedAt": BsonDateTime::from_chrono(now),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_domains.sync")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("domain".to_owned()));
    }
    Ok(Json(SyncDomainResponse {
        domain_id: oid.to_hex(),
        status: "connected".to_owned(),
        last_sync_at: now.to_rfc3339(),
    }))
}
