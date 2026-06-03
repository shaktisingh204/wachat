//! HTTP handlers for the SabCRM tags domain.
//!
//! CRUD over the `sabcrm_tags` Mongo collection.
//!
//! | Endpoint                              | Action |
//! |---------------------------------------|--------|
//! | `GET    /v1/sabcrm/tags`              | list   |
//! | `POST   /v1/sabcrm/tags`              | create |
//! | `PATCH  /v1/sabcrm/tags/{id}`         | update |
//! | `DELETE /v1/sabcrm/tags/{id}`         | delete |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint. A per-project unique `name` is enforced in application code:
//! `create` (and a `name`-changing `update`) reject a duplicate with
//! `409 Conflict`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateTagInput, ListQuery, ListResponse, OkResponse, ScopeQuery, TagResponse, UpdateTagInput,
};

/// The Mongo collection backing tag definitions.
const TAGS_COLL: &str = "sabcrm_tags";

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

/// Return `true` when a tag with `name` already exists in `project_id`,
/// optionally excluding the document with id `exclude`.
async fn name_taken(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    name: &str,
    exclude: Option<&ObjectId>,
) -> Result<bool> {
    let mut filter = doc! { "projectId": project_id, "name": name };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    let existing = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one")))?;
    Ok(existing.is_some())
}

// ===========================================================================
// GET / — list
// ===========================================================================

/// `GET /v1/sabcrm/tags` — list the tags for a project, newest first
/// (`createdAt` desc).
#[instrument(skip_all)]
pub async fn list_tags(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find")))?;

    let mut tags = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.cursor")))?
    {
        tags.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { tags }))
}

// ===========================================================================
// POST / — create
// ===========================================================================

/// `POST /v1/sabcrm/tags` — create a tag. Rejects a duplicate `name`
/// within the project with `409 Conflict`. `createdAt` is set server-side
/// (RFC3339).
#[instrument(skip_all)]
pub async fn create_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateTagInput>,
) -> Result<Json<TagResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    let color = body.color.as_deref().unwrap_or("").trim().to_owned();

    let coll = mongo.collection::<Document>(TAGS_COLL);

    if name_taken(&coll, project_id, name, None).await? {
        return Err(ApiError::Conflict(
            "A tag with that name already exists.".to_owned(),
        ));
    }

    let new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "name": name,
        "color": color,
        "createdAt": Utc::now().to_rfc3339(),
    };

    coll.insert_one(&new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.insert_one")))?;

    Ok(Json(TagResponse {
        tag: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — update
// ===========================================================================

/// `PATCH /v1/sabcrm/tags/{id}` — partial update of `name` / `color`,
/// scoped by `{ projectId, _id }`. A `name` change that collides with
/// another tag in the project fails with `409 Conflict`. Returns the
/// updated tag, or `404` if none matched.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTagInput>,
) -> Result<Json<TagResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);

    let mut set = Document::new();
    if let Some(name) = body.name.as_deref() {
        let name = name.trim();
        if name.is_empty() {
            return Err(ApiError::Validation("name cannot be empty.".to_owned()));
        }
        if name_taken(&coll, project_id, name, Some(&oid)).await? {
            return Err(ApiError::Conflict(
                "A tag with that name already exists.".to_owned(),
            ));
        }
        set.insert("name", name);
    }
    if let Some(color) = body.color.as_deref() {
        set.insert("color", color.trim());
    }

    if set.is_empty() {
        // Nothing to change — just return the current document (or 404).
        let current = coll
            .find_one(doc! { "projectId": project_id, "_id": oid })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one(current)"))
            })?
            .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;
        return Ok(Json(TagResponse {
            tag: record_to_wire(current),
        }));
    }

    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;

    Ok(Json(TagResponse {
        tag: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — delete
// ===========================================================================

/// `DELETE /v1/sabcrm/tags/{id}` — scoped delete. Returns `404` if no tag
/// matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.delete_one")))?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("tag".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
