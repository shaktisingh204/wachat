//! HTTP handlers for the SabChat conversations domain.
//!
//! Every handler enforces tenancy by filtering on
//! `tenantId == ObjectId::parse_str(&auth.tenant_id)`. An unparseable
//! subject yields [`ApiError::Unauthorized`]. Cross-tenant reads /
//! writes therefore surface as plain `404`s, since the tenant clause
//! never matches a foreign-tenant document.
//!
//! ## Mutation envelope
//!
//! Every mutating handler:
//!
//! 1. Parses path / body params, validating ids.
//! 2. Loads the existing conversation (tenant-scoped) — `404` on miss.
//! 3. Runs the Mongo write with `updatedAt = now` rolled in.
//! 4. Appends a single document to the `sabchat_audit_log` collection
//!    (and, for assignee changes, also to `sabchat_assignments`).
//! 5. Returns the freshly-read conversation document via
//!    [`ConversationResponse`].
//!
//! Audit failures fail the request — see [`crate::audit::write_audit`].

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::ConversationStatus;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::audit::write_audit;
use crate::dto::{
    AddLabelBody, ConversationResponse, CreateConversationBody, DEFAULT_LIMIT,
    ListConversationsQuery, ListConversationsResponse, MAX_LIMIT, SnoozeBody, UpdateAssigneeBody,
    UpdatePriorityBody, UpdateStatusBody,
};
use crate::state::SabChatConversationsState;

/// Primary collection — round-trips
/// [`sabchat_types::SabChatConversation`].
const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Assignment history collection.
const ASSIGNMENTS_COLL: &str = "sabchat_assignments";

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is treated as an auth failure (the JWT was issued by
/// us, so a bad value means a tampered token or a buggy issuer).
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value cannot be represented (in
/// practice it always can — `Value` and `Bson` are isomorphic for the
/// shapes we handle).
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

/// Parse the actor (`auth.user_id`) into an `ObjectId`. Audit / history
/// rows always carry the actor when it is parseable; we degrade to
/// `Bson::Null` rather than failing the request if the subject is a
/// non-ObjectId string (system tokens, e.g.).
fn actor_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

/// Load one conversation, scoped to the caller's tenant. Returns `404`
/// when no matching document exists.
async fn load_conversation_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_id_hex: &str,
) -> Result<Document> {
    let conversation_oid = oid_from_str(conversation_id_hex)?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one(scoped)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Render a conversation document for the wire — hex ObjectIds, ISO
/// 8601 timestamps.
fn render_conversation(doc: Document) -> Value {
    document_to_clean_json(doc)
}

/// Build the actor stanza shared by every audit event. We always send
/// `actorType = "agent"` here — the conversations crate is only ever
/// called from authenticated agent UI / API surfaces. Bots and the
/// visitor-side widget go through `sabchat-messages`.
fn audit_actor(user: &AuthUser) -> (Bson, &'static str) {
    let actor_id: Bson = actor_oid(user).map(Bson::ObjectId).unwrap_or(Bson::Null);
    (actor_id, "agent")
}

// ===========================================================================
// POST / — create_conversation
// ===========================================================================

/// `POST /v1/sabchat/conversations` — open a new conversation between
/// the calling tenant's inbox and a resolved contact.
///
/// The new document is created in [`ConversationStatus::Open`] with
/// zeroed SLA timers and `updatedAt == createdAt == now`. A
/// `conversation_created` audit event is appended on success.
#[instrument(skip_all, fields(inbox_id = %body.inbox_id, contact_id = %body.contact_id))]
pub async fn create_conversation(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Json(body): Json<CreateConversationBody>,
) -> Result<Json<ConversationResponse>> {
    // ---- validation ----------------------------------------------------
    if body.inbox_id.trim().is_empty() || body.contact_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "inboxId and contactId are required.".to_owned(),
        ));
    }

    let tenant = tenant_oid(&user)?;
    let inbox_oid = oid_from_str(&body.inbox_id)?;
    let contact_oid = oid_from_str(&body.contact_id)?;

    // ---- build the document -------------------------------------------
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    // Priority: respect caller, fall back to `medium`. We serialize via
    // serde_json round-trip so the snake_case discriminant matches the
    // shape `SabChatConversation` expects on read-back.
    let priority_str = match body.priority {
        Some(p) => serde_json::to_value(p)
            .ok()
            .and_then(|v| v.as_str().map(str::to_owned))
            .unwrap_or_else(|| "medium".to_owned()),
        None => "medium".to_owned(),
    };

    let custom_attrs = body
        .custom_attrs
        .as_ref()
        .map(serde_value_to_bson)
        .unwrap_or(Bson::Document(Document::new()));

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "status": "open",
        "priority": &priority_str,
        "assigneeId": Bson::Null,
        "teamId": Bson::Null,
        "labels": Bson::Array(Vec::new()),
        "snoozeUntil": Bson::Null,
        "sla": doc! {
            "firstResponseDueAt": Bson::Null,
            "nextResponseDueAt": Bson::Null,
            "resolutionDueAt": Bson::Null,
            "breached": false,
        },
        "lastMessageAt": Bson::Null,
        "lastMessagePreview": Bson::Null,
        "unreadCount": 0_i32,
        "customAttrs": custom_attrs,
        "firstResponseAt": Bson::Null,
        "resolvedAt": Bson::Null,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.insert_one"))
    })?;

    // ---- audit ---------------------------------------------------------
    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": new_oid,
            "inboxId": inbox_oid,
            "contactId": contact_oid,
            "action": "conversation_created",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": Bson::Null,
            "after": doc! {
                "status": "open",
                "priority": &priority_str,
            },
            "createdAt": now_bson,
        },
    )
    .await?;

    Ok(Json(ConversationResponse {
        conversation: render_conversation(new_doc),
    }))
}

// ===========================================================================
// GET / — list_conversations
// ===========================================================================

/// `GET /v1/sabchat/conversations` — paginated inbox list, tenant-scoped.
///
/// Sort order is `lastMessageAt DESC, _id DESC`; the cursor is the hex
/// `_id` of the last document returned. We translate the cursor into a
/// `($lt _id)` clause so the next page is exclusive of the cursor row.
#[instrument(skip_all)]
pub async fn list_conversations(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Query(query): Query<ListConversationsQuery>,
) -> Result<Json<ListConversationsResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- filter --------------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };

    if let Some(inbox) = query.inbox_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("inboxId", oid_from_str(inbox)?);
    }
    if let Some(status) = query.status {
        // Re-serialize via serde so we get the same snake_case
        // discriminant the documents were written with.
        if let Some(s) = serde_json::to_value(status).ok().and_then(|v| {
            v.as_str().map(str::to_owned)
        }) {
            filter.insert("status", s);
        }
    }
    if let Some(assignee) = query.assignee_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("assigneeId", oid_from_str(assignee)?);
    }
    if let Some(label) = query.label.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("labels", label);
    }
    if let Some(q) = query.q.as_deref().filter(|s| !s.is_empty()) {
        filter.insert(
            "lastMessagePreview",
            doc! { "$regex": q, "$options": "i" },
        );
    }
    if let Some(cursor) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(cursor)?;
        // Cursor is the last `_id` we returned. With a `(lastMessageAt
        // DESC, _id DESC)` sort, the next page begins at any document
        // whose `_id` is strictly less than the cursor. We rely on `_id`
        // as the tiebreaker, which is monotonic enough for inbox-style
        // listings.
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    // ---- limit ---------------------------------------------------------
    let limit = query
        .limit
        .filter(|n| *n > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "lastMessageAt": -1, "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.collect"))
    })?;

    // `next_cursor` is the `_id` of the last document if we filled the
    // page — callers can stop pagination once it comes back `None`.
    let next_cursor = if (docs.len() as i64) >= limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    } else {
        None
    };

    let conversations: Vec<Value> = docs.into_iter().map(render_conversation).collect();
    Ok(Json(ListConversationsResponse {
        conversations,
        next_cursor,
    }))
}

// ===========================================================================
// GET /{id} — get_conversation
// ===========================================================================

/// `GET /v1/sabchat/conversations/{id}` — fetch one conversation by id,
/// tenant-scoped.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn get_conversation(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(doc),
    }))
}

// ===========================================================================
// PATCH /{id}/status — update_status
// ===========================================================================

/// `PATCH /v1/sabchat/conversations/{id}/status` — move the
/// conversation between lifecycle states.
///
/// Transitioning to [`ConversationStatus::Resolved`] sets
/// `resolvedAt = now`; transitioning to [`ConversationStatus::Open`]
/// clears `resolvedAt`. A `conversation_status_changed` audit event is
/// appended with the before / after snapshot.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn update_status(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateStatusBody>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let before_status = existing
        .get_str("status")
        .unwrap_or_default()
        .to_owned();
    let after_status = status_to_str(body.status);
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    let mut set = doc! {
        "status": &after_status,
        "updatedAt": now_bson,
    };

    match body.status {
        ConversationStatus::Resolved => {
            set.insert("resolvedAt", now_bson);
        }
        ConversationStatus::Open => {
            // Reopening clears both the resolved stamp and any pending
            // snooze timer.
            set.insert("resolvedAt", Bson::Null);
            set.insert("snoozeUntil", Bson::Null);
        }
        _ => {}
    }

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(status)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_status_changed",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": doc! { "status": &before_status },
            "after": doc! { "status": &after_status },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// PATCH /{id}/priority — update_priority
// ===========================================================================

/// `PATCH /v1/sabchat/conversations/{id}/priority` — update the
/// conversation priority. No status side effects.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn update_priority(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePriorityBody>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let new_priority = serde_json::to_value(body.priority)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .ok_or_else(|| ApiError::Validation("Invalid priority value.".to_owned()))?;
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! { "$set": { "priority": &new_priority, "updatedAt": now_bson } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(priority)"),
        )
    })?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// PATCH /{id}/assignee — update_assignee
// ===========================================================================

/// `PATCH /v1/sabchat/conversations/{id}/assignee` — change (or clear)
/// the conversation's assigned agent.
///
/// Writes both a `sabchat_assignments` row (the history) and a
/// `conversation_assigned` audit event. `assigneeId == None` clears the
/// assignment.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn update_assignee(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateAssigneeBody>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let prev_assignee: Option<ObjectId> = existing.get_object_id("assigneeId").ok();

    let new_assignee: Option<ObjectId> = match body
        .assignee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let new_bson: Bson = new_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null);

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! { "$set": { "assigneeId": new_bson, "updatedAt": now_bson } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(assignee)"),
        )
    })?;

    // ---- assignment history -------------------------------------------
    let reason = body
        .reason
        .as_deref()
        .map(str::to_owned)
        .unwrap_or_else(|| "manual".to_owned());

    let assignments = state.mongo.collection::<Document>(ASSIGNMENTS_COLL);
    let actor_id_opt = actor_oid(&user);
    let actor_bson: Bson = actor_id_opt.map(Bson::ObjectId).unwrap_or(Bson::Null);
    assignments
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "prevAssigneeId": prev_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null),
            "newAssigneeId": new_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null),
            "reason": &reason,
            "actorId": actor_bson.clone(),
            "at": now_bson,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_assignments.insert_one"))
        })?;

    // ---- audit ---------------------------------------------------------
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_assigned",
            "actorType": "agent",
            "actorId": actor_bson,
            "before": doc! {
                "assigneeId": prev_assignee.map(|o| o.to_hex()),
            },
            "after": doc! {
                "assigneeId": new_assignee.map(|o| o.to_hex()),
                "reason": &reason,
            },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// POST /{id}/labels — add_label
// ===========================================================================

/// `POST /v1/sabchat/conversations/{id}/labels` — attach a label.
/// Uses `$addToSet`, so duplicate calls are idempotent.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn add_label(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
    Json(body): Json<AddLabelBody>,
) -> Result<Json<ConversationResponse>> {
    if body.label.trim().is_empty() {
        return Err(ApiError::Validation("Label is required.".to_owned()));
    }

    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! {
            "$addToSet": { "labels": &body.label },
            "$set": { "updatedAt": now_bson },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(label_add)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_labeled",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": Bson::Null,
            "after": doc! { "label": &body.label },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// DELETE /{id}/labels/{label} — remove_label
// ===========================================================================

/// `DELETE /v1/sabchat/conversations/{id}/labels/{label}` — detach a
/// label. `$pull` makes the operation idempotent.
#[instrument(skip_all, fields(conversation_id = %id, label = %label))]
pub async fn remove_label(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path((id, label)): Path<(String, String)>,
) -> Result<Json<ConversationResponse>> {
    if label.trim().is_empty() {
        return Err(ApiError::Validation("Label is required.".to_owned()));
    }

    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! {
            "$pull": { "labels": &label },
            "$set": { "updatedAt": now_bson },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(label_remove)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_unlabeled",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": doc! { "label": &label },
            "after": Bson::Null,
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// POST /{id}/snooze — snooze_conversation
// ===========================================================================

/// `POST /v1/sabchat/conversations/{id}/snooze` — move the conversation
/// into [`ConversationStatus::Snoozed`] and stash the wake-up timestamp
/// on `snoozeUntil`.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn snooze_conversation(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
    Json(body): Json<SnoozeBody>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    let until: DateTime<Utc> = DateTime::parse_from_rfc3339(&body.until)
        .map_err(|e| ApiError::Validation(format!("Invalid `until` (RFC3339 expected): {e}")))?
        .with_timezone(&Utc);
    let until_bson = bson::DateTime::from_chrono(until);
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let before_status = existing.get_str("status").unwrap_or_default().to_owned();

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! {
            "$set": {
                "status": "snoozed",
                "snoozeUntil": until_bson,
                "updatedAt": now_bson,
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(snooze)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_snoozed",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": doc! { "status": &before_status },
            "after": doc! {
                "status": "snoozed",
                "snoozeUntil": until_bson,
            },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// POST /{id}/resolve — resolve_conversation
// ===========================================================================

/// `POST /v1/sabchat/conversations/{id}/resolve` — shortcut that moves
/// the conversation to [`ConversationStatus::Resolved`] and stamps
/// `resolvedAt = now`. Emits a `conversation_resolved` audit event.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn resolve_conversation(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let before_status = existing.get_str("status").unwrap_or_default().to_owned();

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! {
            "$set": {
                "status": "resolved",
                "resolvedAt": now_bson,
                "updatedAt": now_bson,
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(resolve)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_resolved",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": doc! { "status": &before_status },
            "after": doc! {
                "status": "resolved",
                "resolvedAt": now_bson,
            },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// POST /{id}/reopen — reopen_conversation
// ===========================================================================

/// `POST /v1/sabchat/conversations/{id}/reopen` — shortcut that moves
/// the conversation back to [`ConversationStatus::Open`] and clears
/// `resolvedAt`. Emits a `conversation_reopened` audit event.
#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn reopen_conversation(
    user: AuthUser,
    State(state): State<SabChatConversationsState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let before_status = existing.get_str("status").unwrap_or_default().to_owned();

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant },
        doc! {
            "$set": {
                "status": "open",
                "resolvedAt": Bson::Null,
                "snoozeUntil": Bson::Null,
                "updatedAt": now_bson,
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(reopen)"),
        )
    })?;

    let (actor_id, actor_type) = audit_actor(&user);
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_reopened",
            "actorType": actor_type,
            "actorId": actor_id,
            "before": doc! { "status": &before_status },
            "after": doc! { "status": "open" },
            "createdAt": now_bson,
        },
    )
    .await?;

    let fresh = load_conversation_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(ConversationResponse {
        conversation: render_conversation(fresh),
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Map a [`ConversationStatus`] back to the snake_case discriminant
/// used in stored documents. Mirrors the serde tag in
/// [`sabchat_types::ConversationStatus`].
fn status_to_str(s: ConversationStatus) -> String {
    match s {
        ConversationStatus::Open => "open",
        ConversationStatus::Pending => "pending",
        ConversationStatus::Resolved => "resolved",
        ConversationStatus::Snoozed => "snoozed",
    }
    .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_to_str_matches_serde_discriminants() {
        assert_eq!(status_to_str(ConversationStatus::Open), "open");
        assert_eq!(status_to_str(ConversationStatus::Pending), "pending");
        assert_eq!(status_to_str(ConversationStatus::Resolved), "resolved");
        assert_eq!(status_to_str(ConversationStatus::Snoozed), "snoozed");
    }
}
