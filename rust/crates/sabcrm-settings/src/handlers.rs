//! HTTP handlers for the SabCRM settings domain.
//!
//! Read / merge-upsert over the `sabcrm_settings` Mongo collection — one
//! free-form key/value document per project.
//!
//! | Endpoint                          | Purpose                          |
//! |-----------------------------------|----------------------------------|
//! | `GET /v1/sabcrm/settings`         | read the project's `data` (or {}) |
//! | `PUT /v1/sabcrm/settings`         | `$set` each `data.<k>`, upsert     |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The `projectId` is
//! unique on the collection, so there is at most one document per project.
//! The [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::{Map, Value};
use tracing::instrument;

use crate::dto::{GetQuery, SettingsResponse, UpdateQuery, UpdateSettingsInput};

/// The Mongo collection backing per-project settings.
const SETTINGS_COLL: &str = "sabcrm_settings";

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

/// Pull the `data` sub-document out of a stored settings document and clean it
/// into a JSON map. Missing/non-object `data` yields an empty map.
fn data_to_wire(doc: Option<Document>) -> Map<String, Value> {
    let Some(mut doc) = doc else {
        return Map::new();
    };
    let data = doc.remove("data");
    match data {
        Some(Bson::Document(inner)) => match document_to_clean_json(inner) {
            Value::Object(map) => map,
            _ => Map::new(),
        },
        _ => Map::new(),
    }
}

// ===========================================================================
// GET / — read settings
// ===========================================================================

/// `GET /v1/sabcrm/settings` — return the project's settings `data`, or `{}`
/// when the project has no settings document yet.
#[instrument(skip_all)]
pub async fn get_settings(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<GetQuery>,
) -> Result<Json<SettingsResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_settings.find_one"))
        })?;

    Ok(Json(SettingsResponse {
        data: data_to_wire(found),
    }))
}

// ===========================================================================
// PUT / — merge-upsert settings
// ===========================================================================

/// `PUT /v1/sabcrm/settings` — merge the supplied `data` patch into the
/// project's settings document (`$set` each `data.<k>`), bumping `updatedAt`.
/// The document is created on first write (`$setOnInsert` of `_id` +
/// `projectId`). Returns the full merged `data` map.
#[instrument(skip_all)]
pub async fn update_settings(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<UpdateQuery>,
    Json(body): Json<UpdateSettingsInput>,
) -> Result<Json<SettingsResponse>> {
    // Prefer the body projectId; fall back to the query for parity with the
    // favorites surface. Both must be present and agree when both are set.
    let project_id = require_project(&body.project_id)?;
    let query_project = query.project_id.trim();
    if !query_project.is_empty() && query_project != project_id {
        return Err(ApiError::Validation(
            "projectId in query and body must match.".to_owned(),
        ));
    }

    // Build the `$set` patch: `updatedAt`, plus one `data.<k>` per supplied key.
    let mut set = doc! { "updatedAt": Utc::now().to_rfc3339() };
    for (k, v) in body.data.into_iter() {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_settings.to_bson"))
        })?;
        set.insert(format!("data.{k}"), bson);
    }

    let update = doc! {
        "$set": set,
        "$setOnInsert": {
            "_id": ObjectId::new(),
            "projectId": project_id,
        },
    };

    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let merged = coll
        .find_one_and_update(doc! { "projectId": project_id }, update)
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_settings.find_one_and_update(upsert)"),
            )
        })?;

    Ok(Json(SettingsResponse {
        data: data_to_wire(merged),
    }))
}
