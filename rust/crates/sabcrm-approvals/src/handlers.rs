//! HTTP handlers for the SabCRM stage-approvals domain.
//!
//! Lifecycle over the `sabcrm_approvals` Mongo collection.
//!
//! | Endpoint                                   | TS action                    |
//! |--------------------------------------------|------------------------------|
//! | `GET  /v1/sabcrm/approvals`                | `listSabcrmApprovals`        |
//! | `POST /v1/sabcrm/approvals`                | `requestSabcrmStageApproval` |
//! | `POST /v1/sabcrm/approvals/{id}/approve`   | `decideSabcrmApproval`       |
//! | `POST /v1/sabcrm/approvals/{id}/reject`    | `decideSabcrmApproval`       |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open; the caller's `user_id` is recorded as `requestedBy`
//! (create) / `decidedBy` (approve / reject).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{ApprovalResponse, CreateApprovalInput, DecideInput, ListQuery, ListResponse};

/// The Mongo collection backing stage-gate approval requests.
const APPROVALS_COLL: &str = "sabcrm_approvals";

/// Default page size when `limit` is omitted.
const DEFAULT_LIMIT: i64 = 50;

/// Hard cap on `limit` regardless of the requested value.
const MAX_LIMIT: i64 = 200;

/// The lifecycle statuses a request may carry.
const STATUSES: [&str; 3] = ["pending", "approved", "rejected"];

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Reject an empty required string field, naming it in the error.
fn require_str<'a>(value: &'a str, name: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{name} is required.")));
    }
    Ok(v)
}

/// Trim an optional string to `None` when blank.
fn opt_str(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

// ===========================================================================
// GET / — listSabcrmApprovals
// ===========================================================================

/// `GET /v1/sabcrm/approvals` — list approval requests for one project,
/// newest first, optionally narrowed by `status` / `objectSlug` / `recordId`
/// / `pipelineId` / `toStageId`. `page` is 1-based and defaults to 1; `limit`
/// defaults to 50 and is capped at 200. The response carries the resolved
/// `page` / `limit` and the `total` count of matches across all pages.
#[instrument(skip_all)]
pub async fn list_approvals(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(status) = opt_str(&query.status) {
        if !STATUSES.contains(&status) {
            return Err(ApiError::Validation(format!(
                "status must be one of {}.",
                STATUSES.join(" / ")
            )));
        }
        filter.insert("status", status);
    }
    if let Some(object_slug) = opt_str(&query.object_slug) {
        filter.insert("objectSlug", object_slug);
    }
    if let Some(record_id) = opt_str(&query.record_id) {
        filter.insert("recordId", record_id);
    }
    if let Some(pipeline_id) = opt_str(&query.pipeline_id) {
        filter.insert("pipelineId", pipeline_id);
    }
    if let Some(to_stage_id) = opt_str(&query.to_stage_id) {
        filter.insert("toStageId", to_stage_id);
    }

    let page = query.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let limit_u = limit as u64;
    let skip = (page - 1).saturating_mul(limit_u);

    let coll = mongo.collection::<Document>(APPROVALS_COLL);

    let total = coll.count_documents(filter.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_approvals.count"))
    })?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_approvals.find")))?;

    let mut approvals = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_approvals.cursor"))
    })? {
        approvals.push(record_to_wire(d));
    }

    Ok(Json(ListResponse {
        approvals,
        total,
        page,
        limit: limit_u,
    }))
}

// ===========================================================================
// POST / — requestSabcrmStageApproval
// ===========================================================================

/// `POST /v1/sabcrm/approvals` — raise a `pending` approval request for one
/// record's move into a gated stage. `requestedBy` is the caller (from the
/// JWT), never the body. Idempotent on the live gate: when an identical
/// request (`projectId` + `objectSlug` + `recordId` + `toStageId`) is still
/// `pending`, the existing document is returned with `created: false`
/// instead of inserting a duplicate.
#[instrument(skip_all)]
pub async fn create_approval(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateApprovalInput>,
) -> Result<Json<ApprovalResponse>> {
    let project_id = require_project(&body.project_id)?;
    let object_slug = require_str(&body.object_slug, "objectSlug")?;
    let record_id = require_str(&body.record_id, "recordId")?;
    let pipeline_id = require_str(&body.pipeline_id, "pipelineId")?;
    let to_stage_id = require_str(&body.to_stage_id, "toStageId")?;

    // Stored record / pipeline ids must at least be valid ObjectId hex so a
    // dangling request can't be raised against garbage ids.
    oid_from_str(record_id)?;
    oid_from_str(pipeline_id)?;

    let coll = mongo.collection::<Document>(APPROVALS_COLL);

    // Live-gate idempotency: one pending request per (record → target stage).
    let dedup = doc! {
        "projectId": project_id,
        "objectSlug": object_slug,
        "recordId": record_id,
        "toStageId": to_stage_id,
        "status": "pending",
    };
    if let Some(existing) = coll.find_one(dedup).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_approvals.dedup.find_one"))
    })? {
        return Ok(Json(ApprovalResponse {
            approval: record_to_wire(existing),
            created: false,
        }));
    }

    let now = Utc::now().to_rfc3339();
    let mut new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "objectSlug": object_slug,
        "recordId": record_id,
        "pipelineId": pipeline_id,
        "toStageId": to_stage_id,
        "requestedBy": &user.user_id,
        "status": "pending",
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(from_stage_id) = opt_str(&body.from_stage_id) {
        new_doc.insert("fromStageId", from_stage_id);
    }
    if let Some(reason) = opt_str(&body.reason) {
        new_doc.insert("reason", reason);
    }

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_approvals.insert_one"))
    })?;

    Ok(Json(ApprovalResponse {
        approval: record_to_wire(new_doc),
        created: true,
    }))
}

// ===========================================================================
// POST /{id}/approve + /{id}/reject — decideSabcrmApproval
// ===========================================================================

/// Shared decide path: one-shot transition of a `pending` request to
/// `approved` / `rejected`, stamping `decidedBy` (the caller), `decidedAt`
/// and the optional `note`. `404` when no **pending** request matches
/// `{ projectId, _id }` — already-decided requests cannot be re-decided.
async fn decide(
    user: AuthUser,
    mongo: MongoHandle,
    id: String,
    body: DecideInput,
    status: &str,
) -> Result<Json<ApprovalResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let now = Utc::now().to_rfc3339();
    let mut set = doc! {
        "status": status,
        "decidedBy": &user.user_id,
        "decidedAt": &now,
        "updatedAt": &now,
    };
    match opt_str(&body.note) {
        Some(note) => set.insert("note", note),
        None => set.insert("note", Bson::Null),
    };

    let coll = mongo.collection::<Document>(APPROVALS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid, "status": "pending" },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_approvals.decide.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("pending approval".to_owned()))?;

    Ok(Json(ApprovalResponse {
        approval: record_to_wire(updated),
        created: true,
    }))
}

/// `POST /v1/sabcrm/approvals/{id}/approve` — approve a pending request.
#[instrument(skip_all, fields(id = %id))]
pub async fn approve_approval(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<DecideInput>,
) -> Result<Json<ApprovalResponse>> {
    decide(user, mongo, id, body, "approved").await
}

/// `POST /v1/sabcrm/approvals/{id}/reject` — reject a pending request.
#[instrument(skip_all, fields(id = %id))]
pub async fn reject_approval(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<DecideInput>,
) -> Result<Json<ApprovalResponse>> {
    decide(user, mongo, id, body, "rejected").await
}
