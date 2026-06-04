//! HTTP handlers for the SabCRM record-page-layout domain.
//!
//! Manages the single layout per `(projectId, object)` in the
//! `sabcrm_page_layouts` Mongo collection.
//!
//! | Endpoint                                  | Effect                          |
//! |-------------------------------------------|---------------------------------|
//! | `GET    /v1/sabcrm/page-layouts`          | read the object's layout (404 or default) |
//! | `GET    /v1/sabcrm/page-layouts/default`  | the per-object default layout   |
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

use crate::dto::{
    LayoutResponse, OkResponse, PageLayoutType, SaveLayoutInput, ScopeQuery, Tab,
    default_layout_tabs,
};

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

/// Read the persisted `pageLayoutType` from a stored document, tolerating an
/// absent / null / unknown value by falling back to the default (`DETAIL`).
fn page_layout_type_from_doc(doc: &Document) -> PageLayoutType {
    match doc.get_str("pageLayoutType") {
        Ok("FORM") => PageLayoutType::Form,
        // "DETAIL", any other string, or absent → the default detail surface.
        _ => PageLayoutType::Detail,
    }
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
    let page_layout_type = page_layout_type_from_doc(doc);
    let tabs = tabs_from_doc(doc)?;

    Ok(LayoutResponse {
        id,
        project_id,
        object,
        page_layout_type,
        is_default: false,
        tabs,
        created_at,
        updated_at,
    })
}

/// Build a server-side **default** layout response for an object that has no
/// stored row. Not persisted: `id` and the timestamps are empty and
/// `isDefault` is `true`. Shape matches the front-end's `defaultLayout`.
fn default_response(project_id: &str, object: &str) -> LayoutResponse {
    LayoutResponse {
        id: String::new(),
        project_id: project_id.to_owned(),
        object: object.to_owned(),
        page_layout_type: PageLayoutType::Detail,
        is_default: true,
        tabs: default_layout_tabs(),
        created_at: String::new(),
        updated_at: String::new(),
    }
}

// ===========================================================================
// GET / — read the object's layout
// ===========================================================================

/// `GET /v1/sabcrm/page-layouts?projectId=&object=[&withDefault=true]` — the
/// single layout for one object, scoped by `{ projectId, object }`.
///
/// When no layout has been configured: returns `404` by default, or — when
/// `withDefault=true` — the per-object **default** layout (an unpersisted
/// body with `isDefault: true`, an empty `id` and empty timestamps) so the
/// record-detail page can render without a second round-trip.
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
        })?;

    match found {
        Some(doc) => Ok(Json(doc_to_response(&doc)?)),
        None if query.with_default => Ok(Json(default_response(project_id, object))),
        None => Err(ApiError::NotFound("page layout".to_owned())),
    }
}

// ===========================================================================
// GET /default — the per-object default layout (never 404, never persisted)
// ===========================================================================

/// `GET /v1/sabcrm/page-layouts/default?projectId=&object=` — the per-object
/// **default** layout, always returned (the row is never consulted and never
/// written). Mirrors the front-end editor's `defaultLayout(object)` and the
/// record-detail fixed-tab fallback, so the *Reset* preview and the
/// server-seeded default agree. The body carries `isDefault: true`, an empty
/// `id` and empty timestamps.
#[instrument(skip_all)]
pub async fn get_default_layout(
    _user: AuthUser,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<LayoutResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = require_object(&query.object)?;
    Ok(Json(default_response(project_id, object)))
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
    let page_layout_type = body.page_layout_type.as_str();
    let now = Utc::now().to_rfc3339();

    let coll = mongo.collection::<Document>(LAYOUTS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "object": object },
            doc! {
                "$set": {
                    "tabs": tabs_bson,
                    "pageLayoutType": page_layout_type,
                    "updatedAt": &now,
                },
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
