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

use crate::dto::{
    AddFavoriteInput, FavoriteResponse, ListQuery, ListResponse, OkResponse, RemoveFavoriteQuery,
};

/// The Mongo collection backing per-user favorites.
const FAVORITES_COLL: &str = "sabcrm_favorites";

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
// GET / — listFavorites
// ===========================================================================

/// `GET /v1/sabcrm/favorites` — list the caller's favorites for a project,
/// newest first (`createdAt` desc). `userId` is the caller from `AuthUser`.
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
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.find")))?;

    let mut favorites = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_favorites.cursor"))
    })? {
        favorites.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { favorites }))
}

// ===========================================================================
// POST / — addFavorite
// ===========================================================================

/// `POST /v1/sabcrm/favorites` — upsert a favorite for the caller. Idempotent
/// on the unique key `(projectId, userId, object, recordId)`; `createdAt`
/// is set once (`$setOnInsert`).
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
                anyhow::Error::new(e).context("sabcrm_favorites.find_one_and_update(upsert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "sabcrm_favorites.upsert returned no document"
            ))
        })?;

    Ok(Json(FavoriteResponse {
        favorite: record_to_wire(upserted),
    }))
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
