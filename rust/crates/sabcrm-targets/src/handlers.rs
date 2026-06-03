//! HTTP handlers for the SabCRM targets domain.
//!
//! Polymorphic junctions over the `sabcrm_targets` Mongo collection,
//! linking a source activity (`notes` | `tasks` | `activities`) to MANY
//! records of ANY object — Twenty's `task-target` / `note-target` pattern.
//!
//! | Endpoint                                  | Direction                       |
//! |-------------------------------------------|---------------------------------|
//! | `GET    /v1/sabcrm/targets`               | targets of a source activity    |
//! | `GET    /v1/sabcrm/targets/for-record`    | sources attached to a record    |
//! | `POST   /v1/sabcrm/targets`               | link (idempotent upsert)        |
//! | `DELETE /v1/sabcrm/targets`               | unlink                          |
//!
//! ## Tenancy
//!
//! Every read and write leads with `projectId`. The [`AuthUser`] extractor
//! is required on every endpoint so the surface is never anonymously open.
//! The idempotent key is
//! `(projectId, sourceObject, sourceId, targetObject, targetId)`.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    LinkTargetInput, ListForRecordQuery, ListForSourceQuery, ListResponse, OkResponse,
    TargetResponse, UnlinkTargetQuery,
};

/// The Mongo collection backing polymorphic targets.
const TARGETS_COLL: &str = "sabcrm_targets";

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

/// Reject a blank required string field, naming it in the error.
fn require_field<'a>(value: &'a str, field: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{field} is required.")));
    }
    Ok(v)
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

/// Drain a cursor of target documents into wire JSON, newest first.
async fn collect_targets(
    coll: &mongodb::Collection<Document>,
    filter: Document,
) -> Result<Vec<Value>> {
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.find")))?;

    let mut targets = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.cursor")))?
    {
        targets.push(record_to_wire(d));
    }
    Ok(targets)
}

// ===========================================================================
// GET / — targets of a source activity
// ===========================================================================

/// `GET /v1/sabcrm/targets` — the records a single note / task / activity
/// is attached to. Relies on the `(projectId, sourceObject, sourceId)`
/// index.
#[instrument(skip_all)]
pub async fn list_for_source(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListForSourceQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let source_object = require_field(&query.source_object, "sourceObject")?;
    let source_id = require_field(&query.source_id, "sourceId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let targets = collect_targets(
        &coll,
        doc! {
            "projectId": project_id,
            "sourceObject": source_object,
            "sourceId": source_id,
        },
    )
    .await?;

    Ok(Json(ListResponse { targets }))
}

// ===========================================================================
// GET /for-record — sources attached to a record
// ===========================================================================

/// `GET /v1/sabcrm/targets/for-record` — the notes / tasks / activities
/// attached to a single record. Relies on the
/// `(projectId, targetObject, targetId)` index.
#[instrument(skip_all)]
pub async fn list_for_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListForRecordQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let target_object = require_field(&query.target_object, "targetObject")?;
    let target_id = require_field(&query.target_id, "targetId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let targets = collect_targets(
        &coll,
        doc! {
            "projectId": project_id,
            "targetObject": target_object,
            "targetId": target_id,
        },
    )
    .await?;

    Ok(Json(ListResponse { targets }))
}

// ===========================================================================
// POST / — link (idempotent upsert)
// ===========================================================================

/// `POST /v1/sabcrm/targets` — link a source activity to a record.
/// Idempotent on the full key
/// `(projectId, sourceObject, sourceId, targetObject, targetId)`;
/// `createdAt` is set once (`$setOnInsert`).
#[instrument(skip_all)]
pub async fn link_target(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<LinkTargetInput>,
) -> Result<Json<TargetResponse>> {
    let project_id = require_project(&body.project_id)?;
    let source_object = require_field(&body.source_object, "sourceObject")?;
    let source_id = require_field(&body.source_id, "sourceId")?;
    let target_object = require_field(&body.target_object, "targetObject")?;
    let target_id = require_field(&body.target_id, "targetId")?;

    let key = doc! {
        "projectId": project_id,
        "sourceObject": source_object,
        "sourceId": source_id,
        "targetObject": target_object,
        "targetId": target_id,
    };

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let upserted = coll
        .find_one_and_update(
            key.clone(),
            doc! {
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "createdAt": Utc::now().to_rfc3339(),
                },
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_targets.find_one_and_update(upsert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!("sabcrm_targets.upsert returned no document"))
        })?;

    Ok(Json(TargetResponse {
        target: record_to_wire(upserted),
    }))
}

// ===========================================================================
// DELETE / — unlink
// ===========================================================================

/// `DELETE /v1/sabcrm/targets` — unlink a source activity from a record.
/// Idempotent: returns `{ ok: true }` whether or not a row matched.
#[instrument(skip_all)]
pub async fn unlink_target(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<UnlinkTargetQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let source_object = require_field(&query.source_object, "sourceObject")?;
    let source_id = require_field(&query.source_id, "sourceId")?;
    let target_object = require_field(&query.target_object, "targetObject")?;
    let target_id = require_field(&query.target_id, "targetId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    coll.delete_one(doc! {
        "projectId": project_id,
        "sourceObject": source_object,
        "sourceId": source_id,
        "targetObject": target_object,
        "targetId": target_id,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.delete_one")))?;

    Ok(Json(OkResponse { ok: true }))
}
