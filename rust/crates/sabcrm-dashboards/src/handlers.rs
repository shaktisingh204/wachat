//! HTTP handlers for the SabCRM saved-dashboards domain.
//!
//! CRUD over the `sabcrm_dashboards` Mongo collection.
//!
//! | Endpoint                                  | Action            |
//! |-------------------------------------------|-------------------|
//! | `GET    /v1/sabcrm/dashboards`            | list dashboards   |
//! | `POST   /v1/sabcrm/dashboards`            | create dashboard  |
//! | `GET    /v1/sabcrm/dashboards/{id}`       | get dashboard     |
//! | `PATCH  /v1/sabcrm/dashboards/{id}`       | update dashboard  |
//! | `DELETE /v1/sabcrm/dashboards/{id}`       | delete dashboard  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
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
    CreateDashboardInput, DashboardResponse, ListResponse, OkResponse, ScopeQuery,
    UpdateDashboardInput,
};

/// The Mongo collection backing saved dashboards.
const DASHBOARDS_COLL: &str = "sabcrm_dashboards";

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

/// Convert an incoming flattened JSON object into a BSON `Document`, dropping
/// `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.payload.to_bson"))
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
// GET / — list dashboards
// ===========================================================================

/// `GET /v1/sabcrm/dashboards` — list the dashboards for one project, scoped
/// by `{ projectId }`, oldest first.
#[instrument(skip_all)]
pub async fn list_dashboards(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(DASHBOARDS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.find"))
        })?;

    let mut dashboards = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.cursor"))
    })? {
        dashboards.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { dashboards }))
}

// ===========================================================================
// GET /{id} — get dashboard
// ===========================================================================

/// `GET /v1/sabcrm/dashboards/{id}` — fetch a single dashboard scoped by
/// `{ projectId, _id }`. Returns `404` if no dashboard matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_dashboard(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<DashboardResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(DASHBOARDS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("dashboard".to_owned()))?;

    Ok(Json(DashboardResponse {
        dashboard: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — create dashboard
// ===========================================================================

/// `POST /v1/sabcrm/dashboards` — create a saved dashboard. `widgets`
/// defaults to `[]`; `createdAt` / `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_dashboard(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateDashboardInput>,
) -> Result<Json<DashboardResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    // Normalise widgets → a BSON array (default empty).
    let widgets_bson = match body.widgets {
        Some(v) if !v.is_null() => bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.widgets.to_bson"))
        })?,
        _ => Bson::Array(Vec::new()),
    };

    let now = Utc::now().to_rfc3339();
    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    new_doc.insert("widgets", widgets_bson);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(DASHBOARDS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.insert_one"))
    })?;

    Ok(Json(DashboardResponse {
        dashboard: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — update dashboard
// ===========================================================================

/// `PATCH /v1/sabcrm/dashboards/{id}` — partial update. Each key in the
/// flattened body (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt`
/// is always bumped. Returns the updated dashboard.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_dashboard(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDashboardInput>,
) -> Result<Json<DashboardResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(DASHBOARDS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_dashboards.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("dashboard".to_owned()))?;

    Ok(Json(DashboardResponse {
        dashboard: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — delete dashboard
// ===========================================================================

/// `DELETE /v1/sabcrm/dashboards/{id}` — scoped delete. Returns `404` if no
/// dashboard matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_dashboard(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(DASHBOARDS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_dashboards.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("dashboard".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
