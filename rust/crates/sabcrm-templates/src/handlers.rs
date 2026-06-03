//! HTTP handlers for the SabCRM templates domain.
//!
//! CRUD over the `sabcrm_templates` Mongo collection.
//!
//! | Endpoint                                  | TS source            |
//! |-------------------------------------------|----------------------|
//! | `GET    /v1/sabcrm/templates`             | `listTemplates`      |
//! | `POST   /v1/sabcrm/templates`             | `createTemplate`     |
//! | `GET    /v1/sabcrm/templates/{id}`        | `getTemplate`        |
//! | `PATCH  /v1/sabcrm/templates/{id}`        | `updateTemplate`     |
//! | `DELETE /v1/sabcrm/templates/{id}`        | `deleteTemplate`     |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open.

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
    CreateTemplateInput, ListQuery, ListResponse, OkResponse, ScopeQuery, TemplateResponse,
    UpdateTemplateInput,
};

/// The Mongo collection backing templates.
const TEMPLATES_COLL: &str = "sabcrm_templates";

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

/// Convert an incoming flattened JSON object into a BSON `Document`,
/// dropping `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

// ===========================================================================
// GET / — listTemplates
// ===========================================================================

/// `GET /v1/sabcrm/templates` — list the templates for a project, scoped by
/// `{ projectId }` and optionally filtered by `{ kind }`.
#[instrument(skip_all)]
pub async fn list_templates(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(kind) = query.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", kind);
    }

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.find"))
        })?;

    let mut templates = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.cursor"))
    })? {
        templates.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { templates }))
}

// ===========================================================================
// GET /{id} — getTemplate
// ===========================================================================

/// `GET /v1/sabcrm/templates/{id}` — fetch a single template scoped by
/// `{ projectId, _id }`. Returns `404` if no template matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("template".to_owned()))?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — createTemplate
// ===========================================================================

/// `POST /v1/sabcrm/templates` — create a template. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateTemplateInput>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&body.project_id)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    let kind = body.kind.trim();
    if kind.is_empty() {
        return Err(ApiError::Validation("kind is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    new_doc.insert("kind", kind);
    if let Some(subject) = body.subject.as_deref() {
        new_doc.insert("subject", subject);
    }
    new_doc.insert("body", &body.body);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.insert_one"))
    })?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateTemplate
// ===========================================================================

/// `PATCH /v1/sabcrm/templates/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated template.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTemplateInput>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_templates.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("template".to_owned()))?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteTemplate
// ===========================================================================

/// `DELETE /v1/sabcrm/templates/{id}` — scoped delete. Returns `404` if no
/// template matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("template".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
