//! HTTP handlers for the SabCRM notifications domain.
//!
//! CRUD-ish over the `sabcrm_notifications` Mongo collection.
//!
//! | Endpoint                                    | TS action                  |
//! |---------------------------------------------|----------------------------|
//! | `GET    /v1/sabcrm/notifications`           | `listNotifications`        |
//! | `GET    /v1/sabcrm/notifications/count`     | `notificationsCount`       |
//! | `POST   /v1/sabcrm/notifications`           | `createNotification`       |
//! | `POST   /v1/sabcrm/notifications/{id}/read` | `markNotificationRead`     |
//! | `POST   /v1/sabcrm/notifications/read-all`  | `markAllNotificationsRead` |
//! | `DELETE /v1/sabcrm/notifications/{id}`      | `deleteNotification`       |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId, userId }` where `userId`
//! is the caller from the [`AuthUser`](sabnode_auth::AuthUser) extractor.
//! `POST /` is the sole exception: it may target a different `userId` (from
//! the body) to fan a notification out to another user.

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
    CountQuery, CountResponse, CreateNotificationInput, ListQuery, ListResponse, MarkAllReadInput,
    MarkReadInput, NotificationResponse, OkResponse, ReadAllResponse, ScopeQuery,
};

/// The Mongo collection backing per-user notifications.
const NOTIFICATIONS_COLL: &str = "sabcrm_notifications";

/// Hard cap on how many notifications a list returns.
const LIST_LIMIT: i64 = 50;

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
// GET / — listNotifications
// ===========================================================================

/// `GET /v1/sabcrm/notifications` — list the caller's notifications for a
/// project, newest first (`createdAt` desc), capped at 50. When
/// `unreadOnly=true`, only unread rows are returned.
#[instrument(skip_all)]
pub async fn list_notifications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id, "userId": &user.user_id };
    if query.unread_only.unwrap_or(false) {
        filter.insert("read", false);
    }

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(LIST_LIMIT)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.find"))
        })?;

    let mut notifications = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.cursor"))
    })? {
        notifications.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { notifications }))
}

// ===========================================================================
// GET /count — notificationsCount
// ===========================================================================

/// `GET /v1/sabcrm/notifications/count` — the caller's unread count for a
/// project.
#[instrument(skip_all)]
pub async fn count_notifications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<CountQuery>,
) -> Result<Json<CountResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    let unread = coll
        .count_documents(doc! {
            "projectId": project_id,
            "userId": &user.user_id,
            "read": false,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.count_documents"))
        })?;

    Ok(Json(CountResponse { unread }))
}

// ===========================================================================
// POST / — createNotification
// ===========================================================================

/// `POST /v1/sabcrm/notifications` — create a notification. `userId`
/// defaults to the caller but may be overridden in the body to fan out to
/// another user. `createdAt` is server-set; `read` starts `false`.
#[instrument(skip_all)]
pub async fn create_notification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateNotificationInput>,
) -> Result<Json<NotificationResponse>> {
    let project_id = require_project(&body.project_id)?;
    let title = body.title.trim();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required.".to_owned()));
    }

    let target_user = body
        .user_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(user.user_id.as_str());

    let mut doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "userId": target_user,
        "title": title,
        "read": false,
        "createdAt": Utc::now().to_rfc3339(),
    };
    if let Some(v) = body.body.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        doc.insert("body", v);
    }
    if let Some(v) = body.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        doc.insert("kind", v);
    }
    if let Some(v) = body
        .target_object
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("targetObject", v);
    }
    if let Some(v) = body
        .target_record_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("targetRecordId", v);
    }

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    coll.insert_one(&doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.insert_one"))
    })?;

    Ok(Json(NotificationResponse {
        notification: record_to_wire(doc),
    }))
}

// ===========================================================================
// POST /{id}/read — markNotificationRead
// ===========================================================================

/// `POST /v1/sabcrm/notifications/{id}/read` — mark one of the caller's
/// notifications read or unread. Returns `404` if no row matches
/// `{ projectId, userId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn mark_read(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<MarkReadInput>,
) -> Result<Json<NotificationResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "userId": &user.user_id, "_id": oid },
            doc! { "$set": { "read": body.read } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_notifications.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("notification".to_owned()))?;

    Ok(Json(NotificationResponse {
        notification: record_to_wire(updated),
    }))
}

// ===========================================================================
// POST /read-all — markAllNotificationsRead
// ===========================================================================

/// `POST /v1/sabcrm/notifications/read-all` — mark every unread
/// notification of the caller as read. Returns `{ ok, updated }`.
#[instrument(skip_all)]
pub async fn mark_all_read(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<MarkAllReadInput>,
) -> Result<Json<ReadAllResponse>> {
    let project_id = require_project(&body.project_id)?;

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    let result = coll
        .update_many(
            doc! {
                "projectId": project_id,
                "userId": &user.user_id,
                "read": false,
            },
            doc! { "$set": { "read": true } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.update_many"))
        })?;

    Ok(Json(ReadAllResponse {
        ok: true,
        updated: result.modified_count,
    }))
}

// ===========================================================================
// DELETE /{id} — deleteNotification
// ===========================================================================

/// `DELETE /v1/sabcrm/notifications/{id}` — delete one of the caller's
/// notifications. Returns `404` if no row matches
/// `{ projectId, userId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_notification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "userId": &user.user_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("notification".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
