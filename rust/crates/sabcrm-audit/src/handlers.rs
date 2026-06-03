//! HTTP handlers for the SabCRM audit domain.
//!
//! Append / list over the `sabcrm_audit` Mongo collection.
//!
//! | Endpoint                          | Operation        |
//! |-----------------------------------|------------------|
//! | `GET    /v1/sabcrm/audit`         | list entries     |
//! | `POST   /v1/sabcrm/audit`         | append an entry  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The `actorId` recorded
//! on a write is the caller from the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — never a request body. `createdAt` is server-set.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{AppendAuditInput, EntryResponse, ListQuery, ListResponse};

/// The Mongo collection backing the change/audit log.
const AUDIT_COLL: &str = "sabcrm_audit";

/// Default page size when `limit` is omitted.
const DEFAULT_LIMIT: i64 = 100;
/// Hard cap on `limit` regardless of the requested value.
const MAX_LIMIT: i64 = 500;

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
// GET / — list audit entries
// ===========================================================================

/// `GET /v1/sabcrm/audit` — list a project's audit entries, newest first
/// (`createdAt` desc). Optionally filtered by `object` / `recordId`. `limit`
/// defaults to 100 and is capped at 500.
#[instrument(skip_all)]
pub async fn list_audit(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);

    let mut filter = doc! { "projectId": project_id };
    if let Some(object) = query.object.as_deref().map(str::trim) {
        if !object.is_empty() {
            filter.insert("object", object);
        }
    }
    if let Some(record_id) = query.record_id.as_deref().map(str::trim) {
        if !record_id.is_empty() {
            filter.insert("recordId", record_id);
        }
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.find")))?;

    let mut entries = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.cursor")))?
    {
        entries.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { entries }))
}

// ===========================================================================
// POST / — append an audit entry
// ===========================================================================

/// `POST /v1/sabcrm/audit` — append an audit entry for the caller. The
/// `actorId` is the caller (from `AuthUser`) and `createdAt` is server-set.
#[instrument(skip_all)]
pub async fn append_audit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AppendAuditInput>,
) -> Result<Json<EntryResponse>> {
    let project_id = require_project(&body.project_id)?;
    let action = body.action.trim();
    if action.is_empty() {
        return Err(ApiError::Validation("action is required.".to_owned()));
    }

    let mut entry = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "actorId": &user.user_id,
        "action": action,
        "createdAt": Utc::now().to_rfc3339(),
    };

    if let Some(object) = body.object.as_deref().map(str::trim) {
        if !object.is_empty() {
            entry.insert("object", object);
        }
    }
    if let Some(record_id) = body.record_id.as_deref().map(str::trim) {
        if !record_id.is_empty() {
            entry.insert("recordId", record_id);
        }
    }
    if let Some(summary) = body.summary.as_deref().map(str::trim) {
        if !summary.is_empty() {
            entry.insert("summary", summary);
        }
    }
    if let Some(meta) = body.meta.as_ref() {
        let bson = bson::to_bson(meta).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.meta.to_bson"))
        })?;
        if !matches!(bson, Bson::Null) {
            entry.insert("meta", bson);
        }
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    coll.insert_one(&entry)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.insert_one"))
        })?;

    Ok(Json(EntryResponse {
        entry: record_to_wire(entry),
    }))
}
