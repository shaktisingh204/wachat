//! HTTP handlers for the SabChat events domain.
//!
//! This crate's HTTP surface is **read + replay** — domain writes
//! happen implicitly through [`EventBus::publish`](crate::EventBus::publish),
//! called inline from sibling crates as they mutate SabChat state. The
//! routes here exist so operators / dashboards can inspect the log and
//! so late-arriving workers can re-attach by replaying stored events
//! through the in-process bus.
//!
//! | Endpoint                                  | Description                          |
//! |-------------------------------------------|--------------------------------------|
//! | `GET   /v1/sabchat/events`                | filtered, paginated list             |
//! | `GET   /v1/sabchat/events/{id}`           | fetch one event by id                |
//! | `POST  /v1/sabchat/events/replay/{id}`    | re-broadcast a stored envelope       |
//!
//! ## Tenancy
//!
//! Every read filters on `tenantId == ObjectId(auth.tenant_id)`. The
//! tenant id is taken from the JWT, never from the URL — there is no
//! cross-tenant event lookup, and a malformed `tid` claim is treated as
//! `401 Unauthorized` (matches the wachat-contacts + sabchat-audit
//! convention). Replay is similarly scoped: the stored row must belong
//! to the caller's tenant before it is re-broadcast.
//!
//! ## Sort order + pagination
//!
//! Newest-first by `_id`. We rely on the fact that Mongo ObjectIds are
//! monotonic with insertion time, so `_id DESC` is equivalent to
//! `createdAt DESC` and avoids needing a secondary index on
//! `createdAt`. Pagination uses an `_id < cursor` predicate rather
//! than `skip` so the cost stays O(limit) even for tenants with
//! millions of events.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::EVENTS_COLL;
use crate::EventEnvelope;
use crate::dto::{ListEventsQuery, ListEventsResponse, MAX_LIMIT, ReplayResponse};
use crate::state::SabChatEventsState;

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`. The
/// tenant id is required on every read — there is no global event log.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Parse an RFC 3339 timestamp string into a `bson::DateTime` so it can
/// drop straight into a `doc!` filter. Invalid input becomes
/// `400 Bad Request` — the events endpoint is operator-facing, so a
/// clear error here beats silently swallowing the filter.
fn parse_rfc3339(field: &str, raw: &str) -> Result<bson::DateTime> {
    let dt: DateTime<Utc> = DateTime::parse_from_rfc3339(raw)
        .map_err(|e| ApiError::BadRequest(format!("invalid RFC3339 timestamp for `{field}`: {e}")))?
        .with_timezone(&Utc);
    Ok(bson::DateTime::from_chrono(dt))
}

/// Reconstruct an [`EventEnvelope`] from a persisted Mongo document.
///
/// Used by the replay path — the document was originally produced by
/// [`EventEnvelope::to_doc`](crate::EventEnvelope::to_doc), so we know
/// the field layout. We tolerate missing optional fields by falling
/// back to sensible defaults rather than 500-ing, because a malformed
/// row in the log shouldn't break replay for the rest of the tenant.
fn envelope_from_doc(d: &Document) -> Result<EventEnvelope> {
    let tenant_id = d
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("event row missing tenantId")))?;
    let kind = d
        .get_str("kind")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("event row missing kind")))?
        .to_owned();
    let source = d
        .get_str("source")
        .unwrap_or(crate::SOURCE_SYSTEM)
        .to_owned();
    let payload: Value = d
        .get("payload")
        .cloned()
        .map(|b| serde_json::to_value(b).unwrap_or(Value::Null))
        .unwrap_or(Value::Null);
    let created_at: DateTime<Utc> = d
        .get_datetime("createdAt")
        .map(|dt| dt.to_chrono())
        .unwrap_or_else(|_| Utc::now());

    Ok(EventEnvelope {
        tenant_id,
        kind,
        payload,
        source,
        created_at,
    })
}

// ===========================================================================
// GET /v1/sabchat/events
// ===========================================================================

/// `GET /v1/sabchat/events` — paginated event log for the caller's
/// tenant.
///
/// Filters are all optional; an empty query returns the most recent
/// `DEFAULT_LIMIT` events for the tenant. Pagination is cursor-style on
/// `_id`, newest first. The response carries a `nextCursor` field —
/// when present, pass it back as `cursor` to fetch the next page.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_events(
    user: AuthUser,
    State(state): State<SabChatEventsState>,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<ListEventsResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Build filter ---------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };

    if let Some(kind) = query.kind.as_deref().filter(|s| !s.is_empty()) {
        // Passed through verbatim — unknown values yield an empty
        // result set rather than a 400, matching the sabchat-audit
        // contract.
        filter.insert("kind", kind);
    }

    // `since` / `until` filter on the document's `createdAt` field. We
    // honour the half-open `[since, until)` interval the rest of the
    // SabChat surface uses.
    let mut created_at_bounds = Document::new();
    if let Some(raw) = query.since.as_deref().filter(|s| !s.is_empty()) {
        created_at_bounds.insert("$gte", parse_rfc3339("since", raw)?);
    }
    if let Some(raw) = query.until.as_deref().filter(|s| !s.is_empty()) {
        created_at_bounds.insert("$lt", parse_rfc3339("until", raw)?);
    }
    if !created_at_bounds.is_empty() {
        filter.insert("createdAt", created_at_bounds);
    }

    // Cursor pagination — `_id < cursor` for newest-first scroll.
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(raw)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    // ---- Clamp the page size -------------------------------------------
    let limit = query.limit.clamp(1, MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    // ---- Query ----------------------------------------------------------
    let coll = state.mongo.collection::<Document>(EVENTS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_events.find"))
        })?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_events.collect")))?;

    // Read the next cursor off the LAST document (oldest in the page,
    // since we sorted DESC) BEFORE we move the docs through the clean
    // JSON conversion. A short page (`< limit` results) means we're at
    // the end and there is no next cursor.
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let events: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListEventsResponse {
        events,
        next_cursor,
    }))
}

// ===========================================================================
// GET /v1/sabchat/events/{id}
// ===========================================================================

/// `GET /v1/sabchat/events/{id}` — fetch a single event envelope scoped
/// to the caller's tenant. Returns `404` for unknown ids or ids
/// belonging to other tenants (the tenant filter is part of the
/// lookup, so cross-tenant existence is never leaked).
#[instrument(skip_all, fields(tenant = %user.tenant_id, event_id = %event_id))]
pub async fn get_event(
    user: AuthUser,
    State(state): State<SabChatEventsState>,
    Path(event_id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let event_oid = oid_from_str(&event_id)?;

    let coll = state.mongo.collection::<Document>(EVENTS_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": event_oid,
            "tenantId": tenant,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_events.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Event not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// POST /v1/sabchat/events/replay/{id}
// ===========================================================================

/// `POST /v1/sabchat/events/replay/{id}` — re-broadcast a stored
/// envelope on the in-process [`EventBus`](crate::EventBus) without
/// inserting a duplicate row into the log.
///
/// Workflow:
///
/// 1. Look up the row by `_id`, scoped to the caller's tenant. A miss
///    returns `404` (the tenant filter is part of the lookup, so
///    cross-tenant existence is never leaked).
/// 2. Rehydrate an [`EventEnvelope`] from the document.
/// 3. Call [`EventBus::publish_existing`](crate::EventBus::publish_existing)
///    so the envelope flows out to every active subscriber.
/// 4. Reply `{ replayed: true }`.
///
/// Useful when a worker (webhook dispatcher, AI worker, SabFlow
/// trigger) started up after the original publish and needs to
/// re-attach without forcing the publisher to fire a duplicate event.
#[instrument(skip_all, fields(tenant = %user.tenant_id, event_id = %event_id))]
pub async fn replay_event(
    user: AuthUser,
    State(state): State<SabChatEventsState>,
    Path(event_id): Path<String>,
) -> Result<Json<ReplayResponse>> {
    let tenant = tenant_oid(&user)?;
    let event_oid = oid_from_str(&event_id)?;

    let coll = state.mongo.collection::<Document>(EVENTS_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": event_oid,
            "tenantId": tenant,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_events.find_one(replay)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Event not found.".to_owned()))?;

    let envelope = envelope_from_doc(&doc)?;
    state.bus.publish_existing(envelope);

    Ok(Json(ReplayResponse::ok()))
}
