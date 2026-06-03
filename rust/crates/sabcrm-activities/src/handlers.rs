//! HTTP handlers for the SabCRM activities-timeline domain.
//!
//! CRUD over the `sabcrm_activities` Mongo collection.
//!
//! | Endpoint                              | TS source (`activities.server.ts`) |
//! |---------------------------------------|------------------------------------|
//! | `GET    /v1/sabcrm/activities`        | `listActivities`                   |
//! | `POST   /v1/sabcrm/activities`        | `createActivity`                   |
//! | `PATCH  /v1/sabcrm/activities/{id}`   | `updateActivity`                   |
//! | `DELETE /v1/sabcrm/activities/{id}`   | `deleteActivity`                   |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` / target filters as appropriate) — **not** `userId`. Every
//! handler requires the [`AuthUser`](sabnode_auth::AuthUser) extractor so
//! the surface is never anonymously open.

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

use crate::dto::{
    ActivityResponse, CreateActivityInput, ListQuery, ListResponse, OkResponse, ScopeQuery,
    UpdateActivityInput,
};

/// The Mongo collection backing the activities timeline.
const ACTIVITIES_COLL: &str = "sabcrm_activities";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `limit`.
const MAX_LIMIT: u64 = 200;

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
// GET / — listActivities
// ===========================================================================

/// `GET /v1/sabcrm/activities` — timeline list scoped by `{ projectId }`,
/// newest first (`createdAt` desc). `targetObject` + `targetRecordId`
/// narrow to one record; `type` is an optional filter.
#[instrument(skip_all)]
pub async fn list_activities(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);

    let mut filter = doc! { "projectId": project_id };
    if let Some(t) = query
        .target_object
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("targetObject", t);
    }
    if let Some(r) = query
        .target_record_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("targetRecordId", r);
    }
    if let Some(k) = query.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", k);
    }

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.find")))?;

    let mut activities = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.cursor"))
    })? {
        activities.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { activities }))
}

// ===========================================================================
// POST / — createActivity
// ===========================================================================

/// `POST /v1/sabcrm/activities` — create a timeline entry. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateActivityInput>,
) -> Result<Json<ActivityResponse>> {
    let project_id = require_project(&body.project_id)?;

    if body.kind.trim().is_empty() {
        return Err(ApiError::Validation("type is required.".to_owned()));
    }
    if body.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "projectId": project_id,
        "type": body.kind.trim(),
        "title": body.title.trim(),
        "body": body.body.as_deref().unwrap_or("").to_owned(),
        "targetObject": body.target_object.trim(),
        "targetRecordId": body.target_record_id.trim(),
        "authorId": body.author_id.trim(),
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(s) = body.status.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("status", s);
    }
    if let Some(a) = body.assignee_id.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("assigneeId", a);
    }
    if let Some(d) = body.due_at.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("dueAt", d);
    }
    if let Some(attachments) = body.attachments.as_ref().filter(|a| !a.is_empty()) {
        let bson = bson::to_bson(attachments).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_activities.attachments.to_bson"),
            )
        })?;
        new_doc.insert("attachments", bson);
    }

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.insert_one"))
    })?;

    Ok(Json(ActivityResponse {
        activity: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateActivity
// ===========================================================================

/// `PATCH /v1/sabcrm/activities/{id}` — partial update (e.g. task status).
/// Each key in the flattened body (minus `projectId`) is `$set` verbatim;
/// `updatedAt` is always bumped. Returns the updated activity.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateActivityInput>,
) -> Result<Json<ActivityResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let patch = match bson::to_bson(&body.patch).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.patch.to_bson"))
    })? {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };

    let mut set = Document::new();
    for (k, v) in patch {
        // Guard against rewriting tenancy / identity keys.
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        set.insert(k, v);
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_activities.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("activity".to_owned()))?;

    Ok(Json(ActivityResponse {
        activity: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteActivity
// ===========================================================================

/// `DELETE /v1/sabcrm/activities/{id}` — scoped delete. Returns `404` if
/// no activity matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
