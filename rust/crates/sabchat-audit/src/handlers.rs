//! HTTP handlers for the SabChat audit-log domain.
//!
//! This crate's HTTP surface is **read-only** — writes happen inline in
//! sibling crates that mutate SabChat state (a `messages` crate emits a
//! `MessageSent` event from inside its send handler, the
//! `conversations` crate emits `ConversationAssigned`, and so on). The
//! routes here exist so operators / dashboards / customer-success
//! tooling can replay what happened.
//!
//! | Endpoint                              | Description                          |
//! |---------------------------------------|--------------------------------------|
//! | `GET   /v1/sabchat/audit`             | filtered, paginated list             |
//! | `GET   /v1/sabchat/audit/{id}`        | fetch one event by id                |
//!
//! ## Tenancy
//!
//! Every read filters on `tenant_id == ObjectId(auth.tenant_id)`. The
//! tenant id is taken from the JWT, never from the URL — there is no
//! cross-tenant audit lookup, and a malformed `tid` claim is treated as
//! `401 Unauthorized` (matches the wachat-contacts convention).
//!
//! ## Sort order + pagination
//!
//! Newest-first by `_id`. We rely on the fact that Mongo ObjectIds are
//! monotonic with insertion time, so `_id DESC` is equivalent to
//! `createdAt DESC` and avoids needing a secondary index on `createdAt`.
//! Pagination uses an `_id < cursor` predicate rather than `skip` so
//! the cost stays O(limit) even for tenants with millions of events.

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

use crate::AUDIT_COLL;
use crate::dto::{ListAuditQuery, ListAuditResponse, MAX_LIMIT};
use crate::state::SabChatAuditState;

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`. The
/// tenant id is required on every read — there is no global audit log.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Parse an RFC 3339 timestamp string into a `bson::DateTime` so it can
/// drop straight into a `doc!` filter. Invalid input becomes
/// `400 Bad Request` — the audit endpoint is operator-facing, so a
/// clear error here beats silently swallowing the filter.
fn parse_rfc3339(field: &str, raw: &str) -> Result<bson::DateTime> {
    let dt: DateTime<Utc> = DateTime::parse_from_rfc3339(raw)
        .map_err(|e| ApiError::BadRequest(format!("invalid RFC3339 timestamp for `{field}`: {e}")))?
        .with_timezone(&Utc);
    Ok(bson::DateTime::from_chrono(dt))
}

// ===========================================================================
// GET /v1/sabchat/audit
// ===========================================================================

/// `GET /v1/sabchat/audit` — paginated audit log for the caller's
/// tenant.
///
/// Filters are all optional; an empty query returns the most recent
/// `DEFAULT_LIMIT` events for the tenant. Pagination is cursor-style on
/// `_id`, newest first. The response carries a `nextCursor` field —
/// when present, pass it back as `cursor` to fetch the next page.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_events(
    user: AuthUser,
    State(state): State<SabChatAuditState>,
    Query(query): Query<ListAuditQuery>,
) -> Result<Json<ListAuditResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Build filter ---------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };

    if let Some(id) = query.conversation_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("conversationId", oid_from_str(id)?);
    }
    if let Some(id) = query.contact_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("contactId", oid_from_str(id)?);
    }
    if let Some(id) = query.inbox_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("inboxId", oid_from_str(id)?);
    }
    if let Some(id) = query.actor_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("actorId", oid_from_str(id)?);
    }
    if let Some(action) = query.action.as_deref().filter(|s| !s.is_empty()) {
        // `AuditAction` is serialized with `rename_all = "snake_case"`,
        // so the wire form matches what we wrote into Mongo. Passed
        // through verbatim — unknown values yield an empty result set.
        filter.insert("action", action);
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
    let coll = state.mongo.collection::<Document>(AUDIT_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.collect"))
    })?;

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

    Ok(Json(ListAuditResponse {
        events,
        next_cursor,
    }))
}

// ===========================================================================
// GET /v1/sabchat/audit/{id}
// ===========================================================================

/// `GET /v1/sabchat/audit/{id}` — fetch a single audit event scoped to
/// the caller's tenant. Returns `404` for unknown ids or ids belonging
/// to other tenants (the tenant filter is part of the lookup, so
/// cross-tenant existence is never leaked).
#[instrument(skip_all, fields(tenant = %user.tenant_id, event_id = %event_id))]
pub async fn get_event(
    user: AuthUser,
    State(state): State<SabChatAuditState>,
    Path(event_id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let event_oid = oid_from_str(&event_id)?;

    let coll = state.mongo.collection::<Document>(AUDIT_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": event_oid,
            "tenantId": tenant,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Audit event not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}
