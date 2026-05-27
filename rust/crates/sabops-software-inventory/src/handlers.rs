//! HTTP handlers for SabOps software inventory.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
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
    CreateSoftwareInput, CreateSoftwareResponse, DeleteSoftwareResponse, ListQuery,
};
use crate::types::SabopsSoftware;

const COLL: &str = "sabops_software";

fn list_filter(user_id: ObjectId, endpoint_id: Option<&str>, source: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(e) = endpoint_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("endpointId", e);
    }
    if let Some(s) = source {
        if !s.is_empty() {
            filter.insert("source", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsSoftware>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_software(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.endpoint_id.as_deref(), q.source.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "vendor", "version"]);
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
    let coll = mongo.collection::<SabopsSoftware>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_software.find"))
    })?;
    let mut rows: Vec<SabopsSoftware> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_software.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_software(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSoftwareInput>,
) -> Result<Json<CreateSoftwareResponse>> {
    let user_id = user_oid(&user)?;
    let endpoint_oid = oid_from_str(&input.endpoint_id)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let installed_at = input
        .installed_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)));

    let mut entity = SabopsSoftware {
        id: None,
        user_id,
        endpoint_id: endpoint_oid,
        name: input.name,
        version: input.version,
        vendor: input.vendor,
        installed_at,
        size_bytes: input.size_bytes,
        license_key: input.license_key,
        source: input.source,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<SabopsSoftware>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_software.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateSoftwareResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, software_id = %software_id))]
pub async fn delete_software(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(software_id): Path<String>,
) -> Result<Json<DeleteSoftwareResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&software_id)?;
    let coll = mongo.collection::<SabopsSoftware>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_software.delete")))?;
    Ok(Json(DeleteSoftwareResponse {
        deleted: result.deleted_count > 0,
    }))
}
