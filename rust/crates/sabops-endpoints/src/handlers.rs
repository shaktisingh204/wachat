//! HTTP handlers for SabOps endpoints (admin-session surface).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateEndpointInput, CreateEndpointResponse, DeleteEndpointResponse, ListQuery,
    UpdateEndpointInput,
};
use crate::types::SabopsEndpoint;

pub(crate) const COLL: &str = "sabops_endpoints";

const VALID_OS: &[&str] = &["windows", "macos", "linux", "ios", "android"];
const VALID_STATUS: &[&str] = &["online", "offline", "stale", "disabled"];

fn list_filter(
    user_id: ObjectId,
    os: Option<&str>,
    status: Option<&str>,
    tag: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(os) = os {
        if VALID_OS.contains(&os) {
            filter.insert("os", os);
        }
    }
    if let Some(s) = status {
        if VALID_STATUS.contains(&s) {
            filter.insert("status", s);
        }
    }
    if let Some(t) = tag {
        if !t.is_empty() {
            filter.insert("tags", t);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn from_create(input: CreateEndpointInput, user_id: ObjectId) -> SabopsEndpoint {
    let owner_oid = input
        .owner_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    SabopsEndpoint {
        id: None,
        user_id,
        hostname: input.hostname,
        os: input.os,
        os_version: input.os_version,
        agent_version: input.agent_version,
        last_seen_at: None,
        status: input.status.unwrap_or_else(|| "offline".to_owned()),
        ip_address: input.ip_address,
        mac_address: input.mac_address,
        model: input.model,
        serial_number: input.serial_number,
        owner_user_id: owner_oid,
        tags: input.tags,
        health_score: input.health_score,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }
}

fn build_update_doc(patch: UpdateEndpointInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.hostname {
        set.insert("hostname", v);
    }
    if let Some(v) = patch.os {
        set.insert("os", v);
    }
    if let Some(v) = patch.os_version {
        set.insert("osVersion", v);
    }
    if let Some(v) = patch.agent_version {
        set.insert("agentVersion", v);
    }
    if let Some(v) = patch.ip_address {
        set.insert("ipAddress", v);
    }
    if let Some(v) = patch.mac_address {
        set.insert("macAddress", v);
    }
    if let Some(v) = patch.model {
        set.insert("model", v);
    }
    if let Some(v) = patch.serial_number {
        set.insert("serialNumber", v);
    }
    if let Some(v) = patch.owner_user_id {
        if let Ok(oid) = ObjectId::parse_str(&v) {
            set.insert("ownerUserId", oid);
        }
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.health_score {
        set.insert("healthScore", v as i32);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsEndpoint>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_endpoints(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.os.as_deref(),
        q.status.as_deref(),
        q.tag.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["hostname", "serialNumber", "model"]);
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

    let coll = mongo.collection::<SabopsEndpoint>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.find"))
        })?;
    let mut rows: Vec<SabopsEndpoint> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, endpoint_id = %endpoint_id))]
pub async fn get_endpoint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(endpoint_id): Path<String>,
) -> Result<Json<SabopsEndpoint>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&endpoint_id)?;
    let coll = mongo.collection::<SabopsEndpoint>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("endpoint".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_endpoint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEndpointInput>,
) -> Result<Json<CreateEndpointResponse>> {
    let user_id = user_oid(&user)?;
    if input.hostname.trim().is_empty() {
        return Err(ApiError::Validation("hostname is required".to_owned()));
    }
    if !VALID_OS.contains(&input.os.as_str()) {
        return Err(ApiError::Validation(format!(
            "os must be one of {:?}",
            VALID_OS
        )));
    }
    let mut entity = from_create(input, user_id);
    let coll = mongo.collection::<SabopsEndpoint>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateEndpointResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, endpoint_id = %endpoint_id))]
pub async fn update_endpoint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(endpoint_id): Path<String>,
    Json(patch): Json<UpdateEndpointInput>,
) -> Result<Json<SabopsEndpoint>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&endpoint_id)?;
    let coll = mongo.collection::<SabopsEndpoint>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), build_update_doc(patch))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("endpoint".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.refetch")))?
        .ok_or_else(|| ApiError::NotFound("endpoint".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, endpoint_id = %endpoint_id))]
pub async fn delete_endpoint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(endpoint_id): Path<String>,
) -> Result<Json<DeleteEndpointResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&endpoint_id)?;
    let coll = mongo.collection::<SabopsEndpoint>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.delete"))
        })?;
    Ok(Json(DeleteEndpointResponse {
        deleted: result.deleted_count > 0,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_applies_os() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("windows"), None, None);
        assert_eq!(f.get_str("os").unwrap(), "windows");
    }

    #[test]
    fn list_filter_rejects_bogus_status() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("not_a_status"), None);
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn build_update_doc_sets_only_provided() {
        let patch = UpdateEndpointInput {
            hostname: Some("box-01".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch);
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("hostname").unwrap(), "box-01");
        assert!(!set.contains_key("status"));
        assert!(set.contains_key("updatedAt"));
    }
}
