//! HTTP handlers for the SabCRM favorites domain.
//!
//! Upsert / list / remove over the `sabcrm_favorites` Mongo collection.
//!
//! | Endpoint                              | TS source (`favorites.server.ts`) |
//! |---------------------------------------|-----------------------------------|
//! | `GET    /v1/sabcrm/favorites`         | `listFavorites`                   |
//! | `POST   /v1/sabcrm/favorites`         | `addFavorite`                     |
//! | `DELETE /v1/sabcrm/favorites`         | `removeFavorite`                  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId, userId }` where
//! `userId` is the caller from the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — never a request body. The unique key is
//! `(projectId, userId, object, recordId)`.

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

use std::collections::HashMap;

use crate::dto::{
    AddFavoriteInput, FavoriteResponse, ListQuery, ListResponse, OkResponse, RemoveFavoriteQuery,
    ReorderInput,
};

/// The Mongo collection backing per-user favorites.
const FAVORITES_COLL: &str = "sabcrm_favorites";

/// The shared collection backing every SabCRM object record — mirrors
/// `sabcrm-records`. Used to resolve a favorited record's display label.
const RECORDS_COLL: &str = "sabcrm_records";

/// Gap between successive `position` values when (re)assigning slots. Wide
/// enough to leave head-room, mirroring Twenty's fractional positioning so a
/// single insert rarely needs to renumber the whole list.
const POSITION_STEP: f64 = 1000.0;

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

/// Trimmed non-empty `data.<key>` string, or `None`.
fn data_str<'a>(data: &'a Document, key: &str) -> Option<&'a str> {
    data.get_str(key).ok().map(str::trim).filter(|s| !s.is_empty())
}

/// Derive a human label for a favorited record from its likely title field, in
/// priority order: `name` → `title` → `firstName`+`lastName` → `email`. Falls
/// back to the hex id when nothing usable is present. Mirrors the derivation in
/// `sabcrm-records` so favorites and the records surface label identically.
fn derive_label(data: &Document, id: &str) -> String {
    if let Some(name) = data_str(data, "name") {
        return name.to_owned();
    }
    if let Some(title) = data_str(data, "title") {
        return title.to_owned();
    }
    let first = data_str(data, "firstName");
    let last = data_str(data, "lastName");
    if first.is_some() || last.is_some() {
        let joined = [first, last]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ");
        if !joined.is_empty() {
            return joined;
        }
    }
    if let Some(email) = data_str(data, "email") {
        return email.to_owned();
    }
    id.to_owned()
}

/// Resolve the display label of one favorited target record. Looks the record
/// up in `sabcrm_records` by `{ projectId, object, _id }` (the same tenant
/// scope `sabcrm-records` uses) and derives a label from its `data`. Returns
/// `None` when `record_id` isn't a valid `ObjectId` or no record matches —
/// callers treat that as a dangling favorite (no label, `recordExists: false`).
async fn resolve_record_label(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    object: &str,
    record_id: &str,
) -> Result<Option<String>> {
    let Ok(oid) = ObjectId::parse_str(record_id.trim()) else {
        return Ok(None);
    };
    let found = coll
        .find_one(doc! { "projectId": project_id, "object": object, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.resolve_label.find_one"))
        })?;
    Ok(found.map(|d| {
        let data = d.get_document("data").ok();
        match data {
            Some(data) => derive_label(data, record_id),
            None => record_id.to_owned(),
        }
    }))
}

/// Annotate a favorite's wire JSON with display fields: `recordLabel` (the
/// resolved label or `null`) and `recordExists` (whether the target still
/// exists). Additive — never strips existing keys.
fn annotate_label(mut favorite: Value, label: Option<String>) -> Value {
    if let Value::Object(map) = &mut favorite {
        let exists = label.is_some();
        map.insert(
            "recordLabel".to_owned(),
            label.map(Value::String).unwrap_or(Value::Null),
        );
        map.insert("recordExists".to_owned(), Value::Bool(exists));
    }
    favorite
}

// ===========================================================================
// GET / — listFavorites
// ===========================================================================

/// `GET /v1/sabcrm/favorites` — list the caller's favorites for a project in
/// stable display order: `position` ascending, then `createdAt` ascending as a
/// tie-break (older first when positions collide or are absent). `userId` is
/// the caller from `AuthUser`. Each favorite is annotated with `recordLabel`
/// (the favorited record's resolved display label) and `recordExists`.
#[instrument(skip_all)]
pub async fn list_favorites(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(FAVORITES_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id, "userId": &user.user_id })
        .sort(doc! { "position": 1, "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.find")))?;

    let mut docs = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.cursor"))
    })? {
        docs.push(d);
    }

    // Batch-resolve the favorited records' labels in a single query against
    // `sabcrm_records`, keyed by `(object, recordId)` — avoids an N+1 fan-out.
    let records = mongo.collection::<Document>(RECORDS_COLL);
    let labels = resolve_labels_batch(&records, project_id, &docs).await?;

    let favorites = docs
        .into_iter()
        .map(|d| {
            let object = d.get_str("object").unwrap_or_default().to_owned();
            let record_id = d.get_str("recordId").unwrap_or_default().to_owned();
            let label = labels.get(&(object, record_id)).cloned();
            annotate_label(record_to_wire(d), label)
        })
        .collect();

    Ok(Json(ListResponse { favorites }))
}

/// Resolve display labels for a batch of favorite docs in one `$or` query
/// against `sabcrm_records`, returning a map `(object, recordId) → label`.
/// Favorites whose `recordId` isn't a valid `ObjectId`, or whose target no
/// longer exists, are simply absent from the map (treated as dangling).
async fn resolve_labels_batch(
    records: &mongodb::Collection<Document>,
    project_id: &str,
    favorites: &[Document],
) -> Result<HashMap<(String, String), String>> {
    let mut out = HashMap::new();

    let clauses: Vec<Document> = favorites
        .iter()
        .filter_map(|d| {
            let object = d.get_str("object").ok()?;
            let record_id = d.get_str("recordId").ok()?;
            let oid = ObjectId::parse_str(record_id.trim()).ok()?;
            Some(doc! { "object": object, "_id": oid })
        })
        .collect();
    if clauses.is_empty() {
        return Ok(out);
    }

    let mut cursor = records
        .find(doc! { "projectId": project_id, "$or": clauses })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.resolve_labels.find"))
        })?;
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.resolve_labels.cursor"))
    })? {
        let object = d.get_str("object").unwrap_or_default().to_owned();
        let id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        if object.is_empty() || id.is_empty() {
            continue;
        }
        let label = match d.get_document("data").ok() {
            Some(data) => derive_label(data, &id),
            None => id.clone(),
        };
        out.insert((object, id), label);
    }

    Ok(out)
}

// ===========================================================================
// POST / — addFavorite
// ===========================================================================

/// `POST /v1/sabcrm/favorites` — upsert a favorite for the caller. Idempotent
/// on the unique key `(projectId, userId, object, recordId)`; `createdAt` and
/// `position` are set once (`$setOnInsert`). A fresh favorite lands at the end
/// of the caller's ordered list (`maxPosition + POSITION_STEP`), so re-adding
/// an existing favorite never reshuffles the list. The response is annotated
/// with the favorited record's `recordLabel` / `recordExists`.
#[instrument(skip_all)]
pub async fn add_favorite(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AddFavoriteInput>,
) -> Result<Json<FavoriteResponse>> {
    let project_id = require_project(&body.project_id)?;
    let object = body.object.trim();
    let record_id = body.record_id.trim();
    if object.is_empty() {
        return Err(ApiError::Validation("object is required.".to_owned()));
    }
    if record_id.is_empty() {
        return Err(ApiError::Validation("recordId is required.".to_owned()));
    }

    let key = doc! {
        "projectId": project_id,
        "userId": &user.user_id,
        "object": object,
        "recordId": record_id,
    };

    let coll = mongo.collection::<Document>(FAVORITES_COLL);

    // Compute the next tail position for this user+project so new favorites are
    // appended in stable order. Cheap single-doc lookup of the current max.
    let next_position = next_tail_position(&coll, project_id, &user.user_id).await?;

    let upserted = coll
        .find_one_and_update(
            key.clone(),
            doc! {
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "createdAt": Utc::now().to_rfc3339(),
                    "position": next_position,
                },
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_favorites.find_one_and_update(upsert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "sabcrm_favorites.upsert returned no document"
            ))
        })?;

    let records = mongo.collection::<Document>(RECORDS_COLL);
    let label = resolve_record_label(&records, project_id, object, record_id).await?;

    Ok(Json(FavoriteResponse {
        favorite: annotate_label(record_to_wire(upserted), label),
    }))
}

/// Compute the position one step past the current maximum among the caller's
/// favorites in `project_id` — the tail slot for a freshly appended favorite.
/// Returns [`POSITION_STEP`] when the user has no favorites yet (or none carry
/// a numeric `position`).
async fn next_tail_position(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    user_id: &str,
) -> Result<f64> {
    let top = coll
        .find_one(doc! { "projectId": project_id, "userId": user_id })
        .sort(doc! { "position": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.max_position"))
        })?;

    let max = top
        .as_ref()
        .and_then(|d| d.get_f64("position").ok().or_else(|| d.get_i64("position").ok().map(|v| v as f64)))
        .unwrap_or(0.0);

    Ok(max + POSITION_STEP)
}

// ===========================================================================
// DELETE / — removeFavorite
// ===========================================================================

/// `DELETE /v1/sabcrm/favorites` — remove a favorite for the caller.
/// Idempotent: returns `{ ok: true }` whether or not a row matched.
#[instrument(skip_all)]
pub async fn remove_favorite(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<RemoveFavoriteQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = query.object.trim();
    let record_id = query.record_id.trim();
    if object.is_empty() {
        return Err(ApiError::Validation("object is required.".to_owned()));
    }
    if record_id.is_empty() {
        return Err(ApiError::Validation("recordId is required.".to_owned()));
    }

    let coll = mongo.collection::<Document>(FAVORITES_COLL);
    coll.delete_one(doc! {
        "projectId": project_id,
        "userId": &user.user_id,
        "object": object,
        "recordId": record_id,
    })
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.delete_one"))
    })?;

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// PATCH /reorder — reorderFavorites
// ===========================================================================

/// `PATCH /v1/sabcrm/favorites/reorder` — reassign `position` across the
/// caller's favorites for a project, mirroring Twenty's drag-to-reorder. Each
/// item's zero-based `position` index is mapped to a spaced numeric slot
/// (`(index + 1) * POSITION_STEP`) so the resulting [`list_favorites`] order
/// matches the submitted order. Only favorites the caller owns in `projectId`
/// are touched; unknown ids and ids owned by another user are silently skipped
/// (the `{ projectId, userId }` scope guards cross-tenant writes). Idempotent;
/// returns `{ ok: true }`.
#[instrument(skip_all)]
pub async fn reorder_favorites(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<ReorderInput>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&body.project_id)?;

    let coll = mongo.collection::<Document>(FAVORITES_COLL);
    for item in &body.items {
        let Ok(oid) = ObjectId::parse_str(item.id.trim()) else {
            return Err(ApiError::Validation(format!(
                "favorite id `{}` is not a valid id.",
                item.id
            )));
        };
        if item.position < 0 {
            return Err(ApiError::Validation(
                "position must be zero or greater.".to_owned(),
            ));
        }

        // Spaced slot so the list sorts in submitted order, with head-room.
        let slot = (item.position as f64 + 1.0) * POSITION_STEP;
        coll.update_one(
            doc! {
                "_id": oid,
                "projectId": project_id,
                "userId": &user.user_id,
            },
            doc! { "$set": { "position": slot } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.reorder.update_one"))
        })?;
    }

    Ok(Json(OkResponse { ok: true }))
}
