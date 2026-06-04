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

use std::collections::HashMap;
use std::convert::Infallible;
use std::time::Duration;

use axum::{
    Json,
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use futures_util::Stream;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ActorRef, CountQuery, CountResponse, CreateNotificationInput, ListQuery, ListResponse,
    MarkAllReadInput, MarkReadInput, NotificationResponse, OkResponse, ReadAllResponse, ScopeQuery,
    StreamQuery,
};

/// The Mongo collection backing per-user notifications.
const NOTIFICATIONS_COLL: &str = "sabcrm_notifications";

/// The CRM records collection — the actor table for `workspaceMembers`.
const RECORDS_COLL: &str = "sabcrm_records";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `limit`.
const MAX_LIMIT: u64 = 200;

/// Notification kinds SabCRM recognises, mirroring Twenty's notification
/// categories. Stored lowercase verbatim. `info` is a generic fallback.
const ALLOWED_KINDS: &[&str] = &["mention", "assignment", "comment", "system", "info"];

/// How often `GET /stream` polls the collection for fresh rows. Kept modest
/// so a fan of open streams stays resource-safe.
const STREAM_POLL_INTERVAL: Duration = Duration::from_millis(2000);
/// Server-side idle ceiling for `GET /stream`: when no new rows arrive for
/// this long the stream is closed so abandoned/zombie connections can't pin a
/// poller forever. Clients are expected to reconnect (EventSource does so
/// automatically).
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(300);
/// SSE keep-alive comment cadence — keeps proxies from culling an idle stream
/// and lets the runtime observe client disconnects promptly for cleanup.
const STREAM_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(15);
/// Max rows drained per poll, bounding memory per tick.
const STREAM_BATCH_LIMIT: i64 = 50;

/// `data` sub-fields probed (in order) for an actor display name.
const NAME_FIELDS: &[&str] = &["name", "displayName", "fullName", "label", "userEmail", "email"];
/// `data` sub-fields probed (in order) for an actor avatar URL.
const AVATAR_FIELDS: &[&str] = &["avatarUrl", "avatar", "photoUrl", "imageUrl", "logo"];

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

/// Normalise and validate a notification `kind`, returning the canonical
/// lowercase form. Unknown kinds are rejected so the surface stays typed.
fn normalize_kind(raw: &str) -> Result<String> {
    let lower = raw.trim().to_ascii_lowercase();
    if ALLOWED_KINDS.contains(&lower.as_str()) {
        Ok(lower)
    } else {
        Err(ApiError::Validation(format!(
            "kind must be one of {}.",
            ALLOWED_KINDS.join(" | ")
        )))
    }
}

/// Read a non-empty trimmed string at `data.<key>` from a record document.
fn data_str<'a>(data: &'a Document, key: &str) -> Option<&'a str> {
    data.get_str(key).ok().map(str::trim).filter(|s| !s.is_empty())
}

/// Build an [`ActorRef`] from a fetched `workspaceMembers` record document,
/// probing the name/avatar field lists. Falls back to the hex id for a name.
fn actor_from_doc(doc: &Document) -> ActorRef {
    let id = doc
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let data = doc.get_document("data").ok();
    let name = data
        .and_then(|d| NAME_FIELDS.iter().find_map(|f| data_str(d, f)))
        .map(str::to_owned)
        .unwrap_or_else(|| id.clone());
    let avatar_url = data
        .and_then(|d| AVATAR_FIELDS.iter().find_map(|f| data_str(d, f)))
        .map(str::to_owned);
    ActorRef {
        id,
        name,
        avatar_url,
    }
}

/// Batch-resolve `actorId`s against the project's `workspaceMembers` records,
/// returning `actorId → ActorRef`. Ids that don't resolve are omitted. Errors
/// from the lookup are swallowed into an empty map so enrichment never fails a
/// list read.
async fn fetch_actor_refs(
    mongo: &MongoHandle,
    project_id: &str,
    actor_ids: &[String],
) -> HashMap<String, ActorRef> {
    let mut out = HashMap::new();
    let oids: Vec<ObjectId> = actor_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect();
    if oids.is_empty() {
        return out;
    }

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let filter = doc! {
        "projectId": project_id,
        "object": "workspaceMembers",
        "_id": { "$in": oids },
    };
    let Ok(mut cursor) = coll.find(filter).await else {
        return out;
    };
    while let Ok(Some(d)) = cursor.try_next().await {
        let actor = actor_from_doc(&d);
        if !actor.id.is_empty() {
            out.insert(actor.id.clone(), actor);
        }
    }
    out
}

/// Enrich a page of wire notifications in place: inject an `actor` object on
/// each row whose `actorId` resolves. Prefers the stored snapshot
/// (`actorName` / `actorAvatarUrl`) and otherwise resolves a fresh `ActorRef`
/// from `workspaceMembers`. Rows without an `actorId` are left untouched.
async fn enrich_actors(mongo: &MongoHandle, project_id: &str, rows: &mut [Value]) {
    // Collect ids that need a live lookup (no usable stored snapshot name).
    let mut to_resolve: Vec<String> = Vec::new();
    for row in rows.iter() {
        let Some(actor_id) = row.get("actorId").and_then(Value::as_str) else {
            continue;
        };
        let actor_id = actor_id.trim();
        if actor_id.is_empty() {
            continue;
        }
        let has_snapshot = row
            .get("actorName")
            .and_then(Value::as_str)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if !has_snapshot {
            to_resolve.push(actor_id.to_owned());
        }
    }

    let resolved = fetch_actor_refs(mongo, project_id, &to_resolve).await;

    for row in rows.iter_mut() {
        let Some(actor_id) = row
            .get("actorId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
        else {
            continue;
        };

        // Snapshot wins when present; else use the resolved ref; else id-only.
        let snapshot_name = row
            .get("actorName")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned);
        let snapshot_avatar = row
            .get("actorAvatarUrl")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned);

        let actor = if let Some(name) = snapshot_name {
            ActorRef {
                id: actor_id.clone(),
                name,
                avatar_url: snapshot_avatar,
            }
        } else if let Some(r) = resolved.get(&actor_id) {
            r.clone()
        } else {
            ActorRef {
                id: actor_id.clone(),
                name: actor_id.clone(),
                avatar_url: snapshot_avatar,
            }
        };

        if let (Value::Object(map), Ok(v)) = (&mut *row, serde_json::to_value(&actor)) {
            map.insert("actor".to_owned(), v);
        }
    }
}

// ===========================================================================
// GET / — listNotifications
// ===========================================================================

/// `GET /v1/sabcrm/notifications` — list the caller's notifications for a
/// project, newest first (`createdAt` desc). Paginated via `limit` (default
/// 50, max 200) + `cursor` (zero-based offset). When `unreadOnly=true`, only
/// unread rows are returned; `kind` narrows to a single notification kind.
///
/// Each row is enriched with an `actor` object (who triggered it) when an
/// `actorId` is stored. The response also carries `total`, `nextCursor`, and
/// `hasMore` for pagination.
#[instrument(skip_all)]
pub async fn list_notifications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);
    let skip = query.cursor.unwrap_or(0);

    let mut filter = doc! { "projectId": project_id, "userId": &user.user_id };
    if query.unread_only.unwrap_or(false) {
        filter.insert("read", false);
    }
    if let Some(k) = query.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", normalize_kind(k)?);
    }

    let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_notifications.count"))
        })?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit as i64)
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

    enrich_actors(&mongo, project_id, &mut notifications).await;

    let returned = notifications.len() as u64;
    let has_more = skip.saturating_add(returned) < total;
    let next_cursor = has_more.then(|| skip.saturating_add(returned));

    Ok(Json(ListResponse {
        notifications,
        total,
        next_cursor,
        has_more,
    }))
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

    // Validate the kind (defaulting to `system`) so the surface stays typed.
    let kind = match body.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(k) => normalize_kind(k)?,
        None => "system".to_owned(),
    };

    // The actor who triggered the notification — defaults to the caller.
    let actor_id = body
        .actor_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(user.user_id.as_str());

    let mut doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "userId": target_user,
        "title": title,
        "kind": &kind,
        "actorId": actor_id,
        "read": false,
        "createdAt": Utc::now().to_rfc3339(),
    };
    if let Some(v) = body.body.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        doc.insert("body", v);
    }
    if let Some(v) = body
        .actor_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("actorName", v);
    }
    if let Some(v) = body
        .actor_avatar_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("actorAvatarUrl", v);
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

    // Enrich the created row's actor for an immediately-usable response.
    let mut notification = record_to_wire(doc);
    {
        let mut rows = [notification];
        enrich_actors(&mongo, project_id, &mut rows).await;
        let [row] = rows;
        notification = row;
    }

    Ok(Json(NotificationResponse { notification }))
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

// ===========================================================================
// GET /stream — real-time push (SSE)
// ===========================================================================

/// `GET /v1/sabcrm/notifications/stream` — a `text/event-stream` of the
/// caller's new notifications for a project.
///
/// On open the stream emits a `ready` event, then polls the collection every
/// [`STREAM_POLL_INTERVAL`] for rows scoped to `{ projectId, userId }` that
/// were inserted after the connection opened (by `_id`, which embeds its
/// creation time). Each new row is sent as a `notification` event whose data is
/// the enriched wire JSON (same shape as the list endpoint), plus a `count`
/// event carrying the caller's current unread total so badges stay live.
///
/// ## Resource safety
///
/// - Only rows created **after** the stream opened are emitted — no historical
///   replay; clients fetch backlog via `GET /`.
/// - A keep-alive comment is sent every [`STREAM_KEEPALIVE_INTERVAL`]; when the
///   client disconnects the underlying TCP write fails, axum drops the response
///   future, and the polling task is cancelled — no manual cleanup required.
/// - After [`STREAM_IDLE_TIMEOUT`] with no new rows the server closes the
///   stream so abandoned connections release their poller; `EventSource`
///   clients reconnect automatically.
#[instrument(skip_all)]
pub async fn stream_notifications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<StreamQuery>,
) -> Result<Sse<impl Stream<Item = std::result::Result<Event, Infallible>>>> {
    let project_id = require_project(&query.project_id)?.to_owned();
    let user_id = user.user_id.clone();

    // Seed the cursor at "now" so only rows inserted after the stream opens are
    // pushed. `ObjectId::new()` embeds the current timestamp.
    let mut last_id: ObjectId = ObjectId::new();

    let stream = async_stream::stream! {
        // Handshake so clients can confirm the stream is live.
        yield Ok::<_, Infallible>(Event::default().event("ready").data("ok"));

        let coll = mongo.collection::<Document>(NOTIFICATIONS_COLL);
        let mut idle_since = std::time::Instant::now();

        loop {
            tokio::time::sleep(STREAM_POLL_INTERVAL).await;

            let filter = doc! {
                "projectId": &project_id,
                "userId": &user_id,
                "_id": { "$gt": last_id },
            };
            let cursor = match coll
                .find(filter)
                .sort(doc! { "_id": 1 })
                .limit(STREAM_BATCH_LIMIT)
                .await
            {
                Ok(c) => c,
                // Transient lookup error — keep the stream alive and retry.
                Err(_) => continue,
            };
            let docs: Vec<Document> = match cursor.try_collect().await {
                Ok(v) => v,
                Err(_) => continue,
            };

            if docs.is_empty() {
                if idle_since.elapsed() >= STREAM_IDLE_TIMEOUT {
                    break;
                }
                continue;
            }
            idle_since = std::time::Instant::now();

            // Advance the cursor and project the rows to enriched wire JSON.
            let mut rows: Vec<Value> = Vec::with_capacity(docs.len());
            for d in &docs {
                if let Ok(oid) = d.get_object_id("_id") {
                    if oid > last_id {
                        last_id = oid;
                    }
                }
                rows.push(record_to_wire(d.clone()));
            }
            enrich_actors(&mongo, &project_id, &mut rows).await;

            for row in &rows {
                if let Ok(payload) = serde_json::to_string(row) {
                    yield Ok(Event::default().event("notification").data(payload));
                }
            }

            // Push the live unread count so badge UIs stay in sync.
            if let Ok(unread) = coll
                .count_documents(doc! {
                    "projectId": &project_id,
                    "userId": &user_id,
                    "read": false,
                })
                .await
            {
                yield Ok(Event::default().event("count").data(unread.to_string()));
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(STREAM_KEEPALIVE_INTERVAL)
            .text("keep-alive"),
    ))
}
