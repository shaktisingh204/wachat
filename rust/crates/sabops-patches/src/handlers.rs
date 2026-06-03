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
    CreatePatchInput, CreatePatchResponse, DeletePatchResponse, ListQuery, UpdatePatchInput,
};
use crate::types::SabopsPatch;

const COLL: &str = "sabops_patches";

const VALID_SEVERITY: &[&str] = &["critical", "high", "medium", "low"];
const VALID_STATUS: &[&str] = &[
    "available",
    "downloading",
    "installed",
    "failed",
    "pending_reboot",
];

fn list_filter(
    user_id: ObjectId,
    endpoint_id: Option<&str>,
    severity: Option<&str>,
    status: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(e) = endpoint_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("endpointId", e);
    }
    if let Some(s) = severity {
        if VALID_SEVERITY.contains(&s) {
            filter.insert("severity", s);
        }
    }
    if let Some(s) = status {
        if VALID_STATUS.contains(&s) {
            filter.insert("status", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_dt(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsPatch>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_patches(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.endpoint_id.as_deref(),
        q.severity.as_deref(),
        q.status.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "kbId"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "releasedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsPatch>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.find"))
        })?;
    let mut rows: Vec<SabopsPatch> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.collect")))?;
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
pub async fn create_patch(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePatchInput>,
) -> Result<Json<CreatePatchResponse>> {
    let user_id = user_oid(&user)?;
    let endpoint_oid = oid_from_str(&input.endpoint_id)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if !VALID_SEVERITY.contains(&input.severity.as_str()) {
        return Err(ApiError::Validation(format!(
            "severity must be one of {:?}",
            VALID_SEVERITY
        )));
    }
    let status = input.status.unwrap_or_else(|| "available".to_owned());
    if !VALID_STATUS.contains(&status.as_str()) {
        return Err(ApiError::Validation(format!(
            "status must be one of {:?}",
            VALID_STATUS
        )));
    }

    let mut entity = SabopsPatch {
        id: None,
        user_id,
        endpoint_id: endpoint_oid,
        name: input.name,
        kb_id: input.kb_id,
        severity: input.severity,
        status,
        released_at: input.released_at.as_deref().and_then(parse_dt),
        deployed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabopsPatch>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePatchResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, patch_id = %patch_id))]
pub async fn update_patch(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(patch_id): Path<String>,
    Json(patch): Json<UpdatePatchInput>,
) -> Result<Json<SabopsPatch>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&patch_id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status {
        if !VALID_STATUS.contains(&v.as_str()) {
            return Err(ApiError::Validation(format!(
                "status must be one of {:?}",
                VALID_STATUS
            )));
        }
        set.insert("status", v);
    }
    if let Some(v) = patch.severity {
        if !VALID_SEVERITY.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid severity".to_owned()));
        }
        set.insert("severity", v);
    }
    if let Some(v) = patch.deployed_at.as_deref().and_then(parse_dt) {
        set.insert("deployedAt", v);
    }

    let coll = mongo.collection::<SabopsPatch>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("patch".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.refetch")))?
        .ok_or_else(|| ApiError::NotFound("patch".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, patch_id = %patch_id))]
pub async fn delete_patch(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(patch_id): Path<String>,
) -> Result<Json<DeletePatchResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&patch_id)?;
    let coll = mongo.collection::<SabopsPatch>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_patches.delete")))?;
    Ok(Json(DeletePatchResponse {
        deleted: result.deleted_count > 0,
    }))
}
