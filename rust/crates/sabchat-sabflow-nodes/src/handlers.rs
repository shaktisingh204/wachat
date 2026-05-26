//! HTTP handlers for the SabChat → SabFlow bridge.
//!
//! Two flavours of handler live here:
//!
//! 1. [`list_nodes`] renders the static node-descriptor catalogue — six
//!    triggers + six actions — as JSON. SabFlow's executor calls this
//!    at boot (and on-demand from the UI block picker).
//!
//! 2. The `action_*` handlers mirror writes that
//!    `sabchat-conversations` / `sabchat-messages` / `sabchat-macros`
//!    already perform. We deliberately **re-implement** those writes
//!    inline (rather than `use sabchat_conversations::…`) because:
//!
//!    * the slice contract forbids sister-crate imports across SabChat
//!      routers, and
//!    * a future executor may want to fire bursts that bypass the HTTP
//!      surface entirely — keeping the writes here means we already
//!      have a `Mongo`-only call path.
//!
//! Every action enforces tenancy by filtering on
//! `tenantId == ObjectId::parse_str(&auth.tenant_id)`. Cross-tenant
//! reads therefore surface as `404 NOT_FOUND` because the tenant clause
//! never matches a foreign document.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabchat_types::{ConversationPriority, ConversationStatus};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::descriptors::descriptors;
use crate::dto::{
    ActionAck, AddLabelBody, NodesResponse, RunMacroBody, SendMessageBody, SetAssigneeBody,
    SetPriorityBody, SetStatusBody,
};
use crate::state::SabChatSabflowNodesState;

// ===========================================================================
// Collection names — kept inline (and in lockstep with the sibling
// SabChat routers).
// ===========================================================================

const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const MACROS_COLL: &str = "sabchat_macros";
const AUDIT_COLL: &str = "sabchat_audit_log";

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is treated as an auth failure.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Best-effort `actor` ObjectId. Service tokens may carry a non-OID
/// subject — we degrade to `None` instead of failing the request.
fn actor_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

/// Load a conversation under the caller's tenant. Returns `404` when no
/// matching document exists (mirrors the cross-tenant policy used by
/// the rest of SabChat — never leak existence).
async fn load_conversation_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_id_hex: &str,
) -> Result<Document> {
    let oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one(scoped)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Append a best-effort audit row. Errors are logged but never
/// propagated — audit failures must not fail user-visible writes.
async fn write_audit(mongo: &MongoHandle, doc: Document) {
    if let Err(err) = mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(doc)
        .await
    {
        tracing::warn!(
            error.detail = %err,
            "sabflow-bridge: failed to write audit event",
        );
    }
}

/// Mirror [`sabchat_types::ConversationStatus`]'s serde tag.
fn status_to_str(s: ConversationStatus) -> &'static str {
    match s {
        ConversationStatus::Open => "open",
        ConversationStatus::Pending => "pending",
        ConversationStatus::Resolved => "resolved",
        ConversationStatus::Snoozed => "snoozed",
    }
}

/// Mirror [`sabchat_types::ConversationPriority`]'s serde tag.
fn priority_to_str(p: ConversationPriority) -> &'static str {
    match p {
        ConversationPriority::Low => "low",
        ConversationPriority::Medium => "medium",
        ConversationPriority::High => "high",
        ConversationPriority::Urgent => "urgent",
    }
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value cannot be represented — never
/// observed in practice for the shapes we accept.
fn value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

// ===========================================================================
// GET /nodes — descriptor catalogue
// ===========================================================================

/// `GET /v1/sabchat/sabflow/nodes` — render the static descriptor list.
///
/// The descriptors are intentionally pure (no DB round-trip) — SabFlow's
/// executor caches the result and the UI re-fetches it on each block
/// picker open.
#[instrument(skip_all)]
pub async fn list_nodes(_user: AuthUser) -> Result<Json<NodesResponse>> {
    Ok(Json(NodesResponse {
        nodes: descriptors(),
    }))
}

// ===========================================================================
// POST /actions/send-message
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/send-message` — append a bot or
/// agent message to a conversation.
///
/// The body's `text` is wrapped in a `Text` content block; carousels /
/// cards are not modelled in the SabFlow MVP. Side-effects mirror
/// `sabchat-messages::handlers::append`:
///
/// * `lastMessageAt` and `lastMessagePreview` patched on the parent
///   conversation (unless the message is private).
/// * `firstResponseAt` stamped on first outbound message (we always
///   write outbound from the executor — never inbound).
/// * `message_sent` audit event appended.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id, private = body.private))]
pub async fn action_send_message(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<SendMessageBody>,
) -> Result<Json<ActionAck>> {
    if body.conversation_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "conversationId is required.".to_owned(),
        ));
    }
    if body.text.trim().is_empty() {
        return Err(ApiError::Validation("text is required.".to_owned()));
    }

    let tenant = tenant_oid(&user)?;
    let conversation = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation.get_object_id("inboxId").ok();
    let contact_oid = conversation.get_object_id("contactId").ok();

    let actor = actor_oid(&user);
    let actor_bson: Bson = actor.map(Bson::ObjectId).unwrap_or(Bson::Null);
    let inbox_bson: Bson = inbox_oid.map(Bson::ObjectId).unwrap_or(Bson::Null);
    let contact_bson: Bson = contact_oid.map(Bson::ObjectId).unwrap_or(Bson::Null);

    // Build the `Text` content block as a plain BSON document so we
    // stay independent of `sabchat_types::ContentBlock`'s serde shape —
    // the wire format is `{ "kind": "text", "text": "..." }`.
    let content_doc = doc! {
        "kind": "text",
        "text": &body.text,
    };

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let msg_oid = ObjectId::new();

    let msg_doc = doc! {
        "_id": msg_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_bson.clone(),
        "contactId": contact_bson.clone(),
        // SabFlow's executor is always non-visitor — bot when the
        // workflow has no actor, agent when the action was triggered by
        // a human via the inline `Run macro` button. We default to
        // `bot` since the typical caller is the autonomous executor.
        "senderType": if body.private { "system" } else { "bot" },
        "senderId": actor_bson.clone(),
        "direction": "outbound",
        "content": Bson::Document(content_doc.clone()),
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": Bson::Document(Document::new()),
        "private": body.private,
        "createdAt": now_bson,
    };

    state
        .mongo
        .collection::<Document>(MESSAGES_COLL)
        .insert_one(msg_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
        })?;

    // ---- Patch the parent conversation --------------------------------
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let mut set_doc = doc! { "lastMessageAt": now_bson, "updatedAt": now_bson };
    if !body.private {
        // Truncate the preview the same way `sabchat-messages` does —
        // 180-char cap for inbox rows.
        let preview: String = body.text.chars().take(180).collect();
        set_doc.insert("lastMessagePreview", preview);

        // First outbound message on this conversation stamps
        // `firstResponseAt` (used by SLA reports).
        let already_set = conversation
            .get("firstResponseAt")
            .and_then(|b| match b {
                Bson::Null => None,
                other => Some(other),
            })
            .is_some();
        if !already_set {
            set_doc.insert("firstResponseAt", now_bson);
        }
    }
    conversations
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(send-message)"),
            )
        })?;

    // ---- Audit --------------------------------------------------------
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "inboxId": inbox_bson,
            "contactId": contact_bson,
            "action": "message_sent",
            "actorType": if body.private { "system" } else { "bot" },
            "actorId": actor_bson,
            "before": Bson::Null,
            "after": doc! {
                "messageId": msg_oid,
                "via": "sabflow",
                "private": body.private,
            },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::with_id(msg_oid.to_hex())))
}

// ===========================================================================
// POST /actions/add-label
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/add-label` — `$addToSet` a label.
/// Idempotent.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id, label = %body.label))]
pub async fn action_add_label(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<AddLabelBody>,
) -> Result<Json<ActionAck>> {
    if body.label.trim().is_empty() {
        return Err(ApiError::Validation("label is required.".to_owned()));
    }

    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! {
                "$addToSet": { "labels": &body.label },
                "$set": { "updatedAt": now_bson },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(add_label)"),
            )
        })?;

    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_labeled",
            "actorType": "bot",
            "actorId": actor_oid(&user).map(Bson::ObjectId).unwrap_or(Bson::Null),
            "before": Bson::Null,
            "after": doc! { "label": &body.label, "via": "sabflow" },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::ok()))
}

// ===========================================================================
// POST /actions/set-status
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/set-status` — move the conversation
/// between lifecycle states.
///
/// `Resolved` stamps `resolvedAt = now`; `Open` clears both `resolvedAt`
/// and any pending snooze — mirrors `sabchat-conversations`.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn action_set_status(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<SetStatusBody>,
) -> Result<Json<ActionAck>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let before_status = existing.get_str("status").unwrap_or_default().to_owned();

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let after_status = status_to_str(body.status);

    let mut set = doc! {
        "status": after_status,
        "updatedAt": now_bson,
    };
    match body.status {
        ConversationStatus::Resolved => {
            set.insert("resolvedAt", now_bson);
        }
        ConversationStatus::Open => {
            set.insert("resolvedAt", Bson::Null);
            set.insert("snoozeUntil", Bson::Null);
        }
        _ => {}
    }

    state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(set_status)"),
            )
        })?;

    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_status_changed",
            "actorType": "bot",
            "actorId": actor_oid(&user).map(Bson::ObjectId).unwrap_or(Bson::Null),
            "before": doc! { "status": &before_status },
            "after": doc! { "status": after_status, "via": "sabflow" },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::ok()))
}

// ===========================================================================
// POST /actions/set-priority
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/set-priority` — update the
/// conversation priority. No status side effects.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn action_set_priority(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<SetPriorityBody>,
) -> Result<Json<ActionAck>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
    let conversation_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let before_priority = existing.get_str("priority").unwrap_or_default().to_owned();

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let after_priority = priority_to_str(body.priority);

    state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! {
                "$set": {
                    "priority": after_priority,
                    "updatedAt": now_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(set_priority)"),
            )
        })?;

    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_priority_changed",
            "actorType": "bot",
            "actorId": actor_oid(&user).map(Bson::ObjectId).unwrap_or(Bson::Null),
            "before": doc! { "priority": &before_priority },
            "after": doc! { "priority": after_priority, "via": "sabflow" },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::ok()))
}

// ===========================================================================
// POST /actions/set-assignee
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/set-assignee` — change or clear the
/// conversation's assigned agent. Writes an assignment-history row plus
/// a `conversation_assigned` audit event so the executor's effect is
/// indistinguishable from a manual reassign in the agent UI.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn action_set_assignee(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<SetAssigneeBody>,
) -> Result<Json<ActionAck>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
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
        Some(s) => Some(
            oid_from_str(s)
                .map_err(|_| ApiError::BadRequest("assigneeId is not a valid ObjectId.".to_owned()))?,
        ),
        None => None,
    };

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let new_bson: Bson = new_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null);

    state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": { "assigneeId": new_bson.clone(), "updatedAt": now_bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(set_assignee)"),
            )
        })?;

    // ---- assignment history -------------------------------------------
    //
    // Mirrors the row `sabchat-conversations` writes — the executor's
    // reassign should show up in the same history feed.
    let actor_bson: Bson = actor_oid(&user).map(Bson::ObjectId).unwrap_or(Bson::Null);
    let _ = state
        .mongo
        .collection::<Document>("sabchat_assignments")
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "prevAssigneeId": prev_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null),
            "newAssigneeId": new_bson.clone(),
            "reason": "sabflow",
            "actorId": actor_bson.clone(),
            "at": now_bson,
        })
        .await;

    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "conversation_assigned",
            "actorType": "bot",
            "actorId": actor_bson,
            "before": doc! { "assigneeId": prev_assignee.map(|o| o.to_hex()) },
            "after": doc! {
                "assigneeId": new_assignee.map(|o| o.to_hex()),
                "via": "sabflow",
            },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::ok()))
}

// ===========================================================================
// POST /actions/run-macro
// ===========================================================================

/// `POST /v1/sabchat/sabflow/actions/run-macro` — look up the macro
/// definition, decode its steps, and apply them inline against the
/// target conversation.
///
/// The implementation walks a deliberately small subset of `MacroStep`
/// kinds — `add_label`, `remove_label`, `set_status`, `set_priority`,
/// `set_assignee`, `send_message`, `snooze`, `resolve`. The `wait` step
/// is intentionally **skipped** here because the SabFlow executor has
/// its own scheduler (this endpoint must not block for tens of seconds
/// at a time).
///
/// Per the slice contract we do not import `sabchat-macros`. The macro
/// document is read straight from `sabchat_macros` and the per-step
/// writes mirror what that crate's `run.rs` does.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id, macro_id = %body.macro_id))]
pub async fn action_run_macro(
    user: AuthUser,
    State(state): State<SabChatSabflowNodesState>,
    Json(body): Json<RunMacroBody>,
) -> Result<Json<ActionAck>> {
    if body.conversation_id.trim().is_empty() || body.macro_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "conversationId and macroId are required.".to_owned(),
        ));
    }
    let tenant = tenant_oid(&user)?;

    // ---- load the macro --------------------------------------------------
    let macro_oid = oid_from_str(&body.macro_id)
        .map_err(|_| ApiError::BadRequest("Invalid macro id.".to_owned()))?;
    let macro_doc = state
        .mongo
        .collection::<Document>(MACROS_COLL)
        .find_one(doc! { "_id": macro_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Macro not found.".to_owned()))?;

    // ---- load conversation (tenant-scoped) ------------------------------
    let conversation = load_conversation_scoped(&state.mongo, tenant, &body.conversation_id).await?;
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;

    // ---- decode steps + walk them best-effort ---------------------------
    let steps = match macro_doc.get_array("steps") {
        Ok(a) => a.clone(),
        Err(_) => Vec::new(),
    };

    let vars = body.vars.unwrap_or(Value::Null);
    let actor = actor_oid(&user);

    for step_bson in &steps {
        let step_doc = match step_bson {
            Bson::Document(d) => d,
            _ => continue,
        };
        let kind = match step_doc.get_str("kind") {
            Ok(k) => k,
            Err(_) => continue,
        };

        let now_bson = bson::DateTime::from_chrono(Utc::now());
        let convs = state.mongo.collection::<Document>(CONVERSATIONS_COLL);

        match kind {
            "add_label" => {
                if let Ok(label) = step_doc.get_str("label") {
                    let _ = convs
                        .update_one(
                            doc! { "_id": conversation_oid, "tenantId": tenant },
                            doc! {
                                "$addToSet": { "labels": label },
                                "$set": { "updatedAt": now_bson },
                            },
                        )
                        .await;
                }
            }
            "remove_label" => {
                if let Ok(label) = step_doc.get_str("label") {
                    let _ = convs
                        .update_one(
                            doc! { "_id": conversation_oid, "tenantId": tenant },
                            doc! {
                                "$pull": { "labels": label },
                                "$set": { "updatedAt": now_bson },
                            },
                        )
                        .await;
                }
            }
            "set_status" => {
                if let Ok(status) = step_doc.get_str("status") {
                    let mut set = doc! {
                        "status": status,
                        "updatedAt": now_bson,
                    };
                    match status {
                        "resolved" => {
                            set.insert("resolvedAt", now_bson);
                        }
                        "open" => {
                            set.insert("resolvedAt", Bson::Null);
                            set.insert("snoozeUntil", Bson::Null);
                        }
                        _ => {}
                    }
                    let _ = convs
                        .update_one(
                            doc! { "_id": conversation_oid, "tenantId": tenant },
                            doc! { "$set": set },
                        )
                        .await;
                }
            }
            "set_priority" => {
                if let Ok(priority) = step_doc.get_str("priority") {
                    let _ = convs
                        .update_one(
                            doc! { "_id": conversation_oid, "tenantId": tenant },
                            doc! { "$set": { "priority": priority, "updatedAt": now_bson } },
                        )
                        .await;
                }
            }
            "set_assignee" => {
                let assignee: Bson = match step_doc.get_str("assigneeId").ok() {
                    Some(s) if !s.is_empty() => match oid_from_str(s) {
                        Ok(o) => Bson::ObjectId(o),
                        Err(_) => Bson::Null,
                    },
                    _ => Bson::Null,
                };
                let _ = convs
                    .update_one(
                        doc! { "_id": conversation_oid, "tenantId": tenant },
                        doc! { "$set": { "assigneeId": assignee, "updatedAt": now_bson } },
                    )
                    .await;
            }
            "resolve" => {
                let _ = convs
                    .update_one(
                        doc! { "_id": conversation_oid, "tenantId": tenant },
                        doc! {
                            "$set": {
                                "status": "resolved",
                                "resolvedAt": now_bson,
                                "updatedAt": now_bson,
                            },
                        },
                    )
                    .await;
            }
            "snooze" => {
                if let Ok(until_iso) = step_doc.get_str("untilIso") {
                    if let Ok(parsed) = DateTime::parse_from_rfc3339(until_iso) {
                        let until_bson = bson::DateTime::from_chrono(parsed.with_timezone(&Utc));
                        let _ = convs
                            .update_one(
                                doc! { "_id": conversation_oid, "tenantId": tenant },
                                doc! {
                                    "$set": {
                                        "status": "snoozed",
                                        "snoozeUntil": until_bson,
                                        "updatedAt": now_bson,
                                    },
                                },
                            )
                            .await;
                    }
                }
            }
            "send_message" => {
                // We render the message verbatim — `{{var}}` substitution
                // is intentionally deferred to a future iteration so the
                // bridge MVP stays predictable. Callers needing
                // interpolation today should call
                // `sabchat-macros::POST /{id}/run` directly.
                let text = step_doc
                    .get_document("content")
                    .ok()
                    .and_then(|c| c.get_str("text").ok().map(str::to_owned))
                    .unwrap_or_default();
                let private = step_doc.get_bool("private").unwrap_or(false);
                if !text.is_empty() {
                    let msg_oid = ObjectId::new();
                    let inbox_oid = conversation.get_object_id("inboxId").ok();
                    let contact_oid = conversation.get_object_id("contactId").ok();
                    let actor_bson: Bson =
                        actor.map(Bson::ObjectId).unwrap_or(Bson::Null);
                    let msg_doc = doc! {
                        "_id": msg_oid,
                        "tenantId": tenant,
                        "conversationId": conversation_oid,
                        "inboxId": inbox_oid.map(Bson::ObjectId).unwrap_or(Bson::Null),
                        "contactId": contact_oid.map(Bson::ObjectId).unwrap_or(Bson::Null),
                        "senderType": if private { "system" } else { "bot" },
                        "senderId": actor_bson,
                        "direction": "outbound",
                        "content": doc! { "kind": "text", "text": &text },
                        "attachments": Bson::Array(Vec::new()),
                        "providerMetadata": Bson::Document(Document::new()),
                        "private": private,
                        "createdAt": now_bson,
                    };
                    let _ = state
                        .mongo
                        .collection::<Document>(MESSAGES_COLL)
                        .insert_one(msg_doc)
                        .await;

                    if !private {
                        let preview: String = text.chars().take(180).collect();
                        let _ = convs
                            .update_one(
                                doc! { "_id": conversation_oid, "tenantId": tenant },
                                doc! {
                                    "$set": {
                                        "lastMessageAt": now_bson,
                                        "lastMessagePreview": preview,
                                        "updatedAt": now_bson,
                                    },
                                },
                            )
                            .await;
                    }
                }
            }
            // `wait` is intentionally skipped — see doc-comment above.
            _ => {}
        }
    }

    // Audit a single roll-up so reports show the macro fired from a
    // workflow run.
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    write_audit(
        &state.mongo,
        doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "action": "macro_run",
            "actorType": "bot",
            "actorId": actor.map(Bson::ObjectId).unwrap_or(Bson::Null),
            "before": Bson::Null,
            "after": doc! {
                "macroId": macro_oid,
                "via": "sabflow",
                "vars": value_to_bson(&vars),
            },
            "createdAt": now_bson,
        },
    )
    .await;

    Ok(Json(ActionAck::with_id(macro_oid.to_hex())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_and_priority_match_serde_discriminants() {
        assert_eq!(status_to_str(ConversationStatus::Open), "open");
        assert_eq!(status_to_str(ConversationStatus::Resolved), "resolved");
        assert_eq!(priority_to_str(ConversationPriority::Low), "low");
        assert_eq!(priority_to_str(ConversationPriority::Urgent), "urgent");
    }
}
