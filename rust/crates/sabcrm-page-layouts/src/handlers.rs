//! HTTP handlers for the SabCRM record-page-layout domain.
//!
//! Manages the single layout per `(projectId, object)` in the
//! `sabcrm_page_layouts` Mongo collection.
//!
//! | Endpoint                                  | Effect                          |
//! |-------------------------------------------|---------------------------------|
//! | `GET    /v1/sabcrm/page-layouts`          | read the object's layout (404)  |
//! | `PUT    /v1/sabcrm/page-layouts`          | upsert the object's layout      |
//! | `DELETE /v1/sabcrm/page-layouts`          | reset to default (delete row)   |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId, object }` — **not**
//! `userId`. Every handler requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor so the surface is never anonymously open.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{mongo::MongoHandle, oid_to_str};
use tracing::instrument;

use crate::dto::{LayoutResponse, OkResponse, SaveLayoutInput, ScopeQuery, Tab};

/// The Mongo collection backing record-page layouts.
const LAYOUTS_COLL: &str = "sabcrm_page_layouts";

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

/// Reject an empty `object` early.
fn require_object(object: &str) -> Result<&str> {
    let o = object.trim();
    if o.is_empty() {
        return Err(ApiError::Validation("object is required.".to_owned()));
    }
    Ok(o)
}

/// Deserialise the persisted `tabs` array out of a stored layout document.
/// Absent / null `tabs` yields an empty list; a malformed shape is a `500`.
fn tabs_from_doc(doc: &Document) -> Result<Vec<Tab>> {
    match doc.get("tabs") {
        None | Some(Bson::Null) => Ok(Vec::new()),
        Some(bson) => bson::from_bson::<Vec<Tab>>(bson.clone()).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_page_layouts.tabs.from_bson"))
        }),
    }
}

/// Serialise the structured `tabs` tree into a BSON array for persistence.
fn tabs_to_bson(tabs: &[Tab]) -> Result<Bson> {
    bson::to_bson(tabs).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_page_layouts.tabs.to_bson"))
    })
}

/// Build the wire response from a freshly read/written layout document.
fn doc_to_response(doc: &Document) -> Result<LayoutResponse> {
    let id = doc
        .get_object_id("_id")
        .map(|oid| oid_to_str(&oid))
        .unwrap_or_default();
    let project_id = doc.get_str("projectId").unwrap_or_default().to_owned();
    let object = doc.get_str("object").unwrap_or_default().to_owned();
    let created_at = doc.get_str("createdAt").unwrap_or_default().to_owned();
    let updated_at = doc.get_str("updatedAt").unwrap_or_default().to_owned();
    let tabs = tabs_from_doc(doc)?;

    Ok(LayoutResponse {
        id,
        project_id,
        object,
        tabs,
        created_at,
        updated_at,
    })
}

// ===========================================================================
// GET / — read the object's layout
// ===========================================================================

/// `GET /v1/sabcrm/page-layouts?projectId=&object=` — the single layout for
/// one object, scoped by `{ projectId, object }`. Returns `404` when no
/// layout has been configured for the object yet.
#[instrument(skip_all)]
pub async fn get_layout(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<LayoutResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = require_object(&query.object)?;

    let coll = mongo.collection::<Document>(LAYOUTS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "object": object })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_page_layouts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("page layout".to_owned()))?;

    Ok(Json(doc_to_response(&found)?))
}

// ===========================================================================
// PUT / — upsert the object's layout
// ===========================================================================

/// `PUT /v1/sabcrm/page-layouts?projectId=&object=` — upsert the single
/// layout for one object. The query-string `projectId` / `object` are
/// authoritative (the body's are ignored for scoping). `createdAt` is set
/// only on insert; `updatedAt` is always bumped. Returns the persisted
/// layout.
#[instrument(skip_all)]
pub async fn save_layout(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
    Json(body): Json<SaveLayoutInput>,
) -> Result<Json<LayoutResponse>> {
    // Query string is authoritative; body must merely be present/valid.
    let project_id = require_project(&query.project_id)?;
    let object = require_object(&query.object)?;
    let _ = require_project(&body.project_id)?;
    let _ = require_object(&body.object)?;

    let tabs_bson = tabs_to_bson(&body.tabs)?;
    let now = Utc::now().to_rfc3339();

    let coll = mongo.collection::<Document>(LAYOUTS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "object": object },
            doc! {
                "$set": { "tabs": tabs_bson, "updatedAt": &now },
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "projectId": project_id,
                    "object": object,
                    "createdAt": &now,
                },
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_page_layouts.find_one_and_update"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "sabcrm_page_layouts.upsert returned no document"
            ))
        })?;

    Ok(Json(doc_to_response(&updated)?))
}

// ===========================================================================
// DELETE / — reset to default
// ===========================================================================

/// `DELETE /v1/sabcrm/page-layouts?projectId=&object=` — reset the object to
/// the default layout by deleting its persisted row. Idempotent: returns
/// `{ ok: true }` whether or not a row existed.
#[instrument(skip_all)]
pub async fn reset_layout(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = require_object(&query.object)?;

    let coll = mongo.collection::<Document>(LAYOUTS_COLL);
    coll.delete_one(doc! { "projectId": project_id, "object": object })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_page_layouts.delete_one"))
        })?;

    Ok(Json(OkResponse { ok: true }))
}
