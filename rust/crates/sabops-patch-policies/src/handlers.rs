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
    ApplyPolicyResponse, CreatePolicyInput, CreatePolicyResponse, DeletePolicyResponse, ListQuery,
    UpdatePolicyInput,
};
use crate::types::SabopsPatchPolicy;

const COLL: &str = "sabops_patch_policies";
const ENDPOINTS_COLL: &str = "sabops_endpoints";

const VALID_ACTIONS: &[&str] = &["auto_install", "notify", "defer"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsPatchPolicy>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_policies(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(e) = q.enabled {
        filter.insert("enabled", e);
    }
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
    let coll = mongo.collection::<SabopsPatchPolicy>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.find"))
    })?;
    let mut rows: Vec<SabopsPatchPolicy> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePolicyInput>,
) -> Result<Json<CreatePolicyResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if !VALID_ACTIONS.contains(&input.action.as_str()) {
        return Err(ApiError::Validation(format!(
            "action must be one of {:?}",
            VALID_ACTIONS
        )));
    }

    let mut entity = SabopsPatchPolicy {
        id: None,
        user_id,
        name: input.name,
        target_selector: input.target_selector,
        schedule: input.schedule,
        action: input.action,
        severity_filter: input.severity_filter,
        enabled: input.enabled.unwrap_or(true),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabopsPatchPolicy>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePolicyResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, policy_id = %policy_id))]
pub async fn update_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
    Json(patch): Json<UpdatePolicyInput>,
) -> Result<Json<SabopsPatchPolicy>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.target_selector {
        let d = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("target_selector encode"))
        })?;
        set.insert("targetSelector", d);
    }
    if let Some(v) = patch.schedule {
        let d = bson::to_bson(&v)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("schedule encode")))?;
        set.insert("schedule", d);
    }
    if let Some(v) = patch.action {
        if !VALID_ACTIONS.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid action".to_owned()));
        }
        set.insert("action", v);
    }
    if let Some(v) = patch.severity_filter {
        set.insert("severityFilter", v);
    }
    if let Some(v) = patch.enabled {
        set.insert("enabled", v);
    }
    let coll = mongo.collection::<SabopsPatchPolicy>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("policy".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("policy".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, policy_id = %policy_id))]
pub async fn delete_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
) -> Result<Json<DeletePolicyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let coll = mongo.collection::<SabopsPatchPolicy>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.delete"))
        })?;
    Ok(Json(DeletePolicyResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Evaluate the policy's target selector against the current endpoint
/// fleet and return how many endpoints would receive the action. The
/// actual deployment is queued by the Next.js worker that consumes this
/// response — Rust stays I/O-pure for the agent flow.
#[instrument(skip_all, fields(user_id = %user.user_id, policy_id = %policy_id))]
pub async fn apply_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
) -> Result<Json<ApplyPolicyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let coll = mongo.collection::<SabopsPatchPolicy>(COLL);
    let policy = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_patch_policies.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("policy".to_owned()))?;

    // Build an endpoint filter from the selector
    let mut ep_filter = doc! { "userId": user_id };
    if let Some(os) = &policy.target_selector.os {
        ep_filter.insert("os", os.as_str());
    }
    if !policy.target_selector.tags.is_empty() {
        let tags: Vec<Bson> = policy
            .target_selector
            .tags
            .iter()
            .map(|t| Bson::String(t.clone()))
            .collect();
        ep_filter.insert("tags", doc! { "$in": tags });
    }
    if !policy.target_selector.endpoint_ids.is_empty() {
        let ids: Vec<Bson> = policy
            .target_selector
            .endpoint_ids
            .iter()
            .map(|o| Bson::ObjectId(*o))
            .collect();
        ep_filter.insert("_id", doc! { "$in": ids });
    }

    let ep_coll = mongo.collection::<Document>(ENDPOINTS_COLL);
    let matched = ep_coll
        .count_documents(ep_filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.count")))?;

    Ok(Json(ApplyPolicyResponse {
        matched_endpoints: matched,
        policy_id: oid.to_hex(),
    }))
}
