//! HTTP handlers for the public SabChat widget surface.
//!
//! These endpoints are **unauthenticated** in the JWT sense — there is
//! no [`AuthUser`](sabnode_auth::AuthUser) extractor. Trust is derived
//! from:
//!
//! - the inbox id (must exist and be `enabled == true`); the tenant
//!   scope is taken from the inbox row;
//! - the opaque `visitorToken` minted in [`start_session`], looked up
//!   on every subsequent call by [`crate::session::resolve_session`];
//! - optionally an `identityHmac` for embedded logged-in app users —
//!   `hex(hmac_sha256(identity_secret, externalUserId))` — verified by
//!   [`crate::session::verify_hmac`].
//!
//! Mongo collections touched:
//!
//! | Collection                     | Read | Write |
//! |--------------------------------|:----:|:-----:|
//! | `sabchat_inboxes`              |  ✓   |       |
//! | `sabchat_contacts`             |  ✓   |   ✓   |
//! | `sabchat_conversations`        |  ✓   |   ✓   |
//! | `sabchat_messages`             |  ✓   |   ✓   |
//! | `sabchat_widget_sessions`      |  ✓   |   ✓   |
//! | `sabchat_audit_log`            |      |   ✓   |

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::{Attachment, ContentBlock};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    EndSessionBody, FetchHistoryQuery, FetchHistoryResponse, HISTORY_MAX_LIMIT, PostMessageBody,
    PostMessageResponse, PublicConfigQuery, PublicConfigResponse, SESSION_TTL_DAYS,
    StartSessionBody, StartSessionResponse, SuccessResponse,
};
use crate::preview::preview_for;
use crate::session::{SESSIONS_COLL, new_token, resolve_session, touch_session, verify_hmac};
use crate::state::SabChatWidgetState;

// ---------------------------------------------------------------------------
// Mongo collection names — kept inline so review against the schema doc
// is a single grep.
// ---------------------------------------------------------------------------
const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const AUDIT_COLL: &str = "sabchat_audit_log";

// ===========================================================================
// GET /config — public_config
// ===========================================================================

/// `GET /config?inboxId=` — public config for the widget bootstrap.
///
/// Behaviour:
/// - `404` when the inbox does not exist (lets the loader bail fast).
/// - `{ enabled: false, ... }` when the inbox exists but is disabled —
///   we deliberately do **not** 404 here so the host page can render a
///   "currently offline" state without leaking inbox enumeration.
/// - On success, fields are read from `channel_config.settings`, the
///   canonical place the inbox UI stores widget configuration.
#[instrument(skip_all, fields(inbox_id = %query.inbox_id))]
pub async fn public_config(
    State(state): State<SabChatWidgetState>,
    Query(query): Query<PublicConfigQuery>,
) -> Result<Json<PublicConfigResponse>> {
    let inbox_oid = oid_from_str(&query.inbox_id)?;

    let inboxes = state.mongo.collection::<Document>(INBOXES_COLL);
    let inbox = inboxes
        .find_one(doc! { "_id": inbox_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    let enabled = inbox.get_bool("enabled").unwrap_or(true);
    if !enabled {
        return Ok(Json(PublicConfigResponse::disabled()));
    }

    // `channel_config.settings` is stored as a free-form sub-document.
    // Reach in defensively — every field is optional and the website
    // channel adapter is the only writer.
    let settings = inbox
        .get_document("channelConfig")
        .ok()
        .and_then(|cc| cc.get_document("settings").ok());

    let str_field = |key: &str| -> Option<String> {
        settings
            .and_then(|s| s.get_str(key).ok())
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
    };

    let business_hours: Value = inbox
        .get_document("businessHours")
        .map(|d| document_to_clean_json(d.clone()))
        .unwrap_or(Value::Null);

    Ok(Json(PublicConfigResponse {
        enabled: true,
        widget_color: str_field("widgetColor"),
        team_name: str_field("teamName"),
        avatar_url: str_field("avatarUrl"),
        welcome_message: str_field("welcomeMessage"),
        away_message: str_field("awayMessage"),
        business_hours,
    }))
}

// ===========================================================================
// POST /session — start_session
// ===========================================================================

/// `POST /session` — resume an existing session or open a new one.
///
/// Flow:
/// 1. Load the inbox; reject if missing or disabled.
/// 2. If `visitorToken` is supplied → look up the session row. If it
///    matches the inbox and is unexpired, return the same session.
/// 3. Otherwise: verify `identityHmac` (when present), resolve-or-
///    create the contact (by `externalUserId` social id or `email`),
///    open a fresh `Pending` conversation, mint a new token, persist
///    the session row, return everything.
#[instrument(skip_all, fields(inbox_id = %body.inbox_id))]
pub async fn start_session(
    State(state): State<SabChatWidgetState>,
    Json(body): Json<StartSessionBody>,
) -> Result<Json<StartSessionResponse>> {
    let mongo = &state.mongo;

    // ---- Inbox lookup + enabled gate ----------------------------------
    let inbox_oid = oid_from_str(&body.inbox_id)?;
    let inbox = mongo
        .collection::<Document>(INBOXES_COLL)
        .find_one(doc! { "_id": inbox_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    if !inbox.get_bool("enabled").unwrap_or(true) {
        return Err(ApiError::Forbidden("inbox is disabled".to_owned()));
    }

    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    let settings = inbox
        .get_document("channelConfig")
        .ok()
        .and_then(|cc| cc.get_document("settings").ok());

    // ---- Resume path: existing visitorToken ---------------------------
    if let Some(token) = body
        .visitor_token
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        // `resolve_session` already verifies expiry. We additionally
        // require the session belongs to the requested inbox — a
        // stolen token for inbox A can't be replayed against inbox B.
        if let Ok(session) = resolve_session(mongo, token).await {
            if session.inbox_id == inbox_oid {
                return Ok(Json(StartSessionResponse {
                    session_id: session.id.to_hex(),
                    visitor_token: session.visitor_token,
                    conversation_id: session.conversation_id.to_hex(),
                    contact_id: session.contact_id.to_hex(),
                    welcome_message: settings_str(settings, "welcomeMessage"),
                    team_name: settings_str(settings, "teamName"),
                    widget_color: settings_str(settings, "widgetColor"),
                }));
            }
            // Token belongs to a different inbox — fall through and
            // mint a fresh session for this one.
        }
    }

    // ---- Identity-HMAC verification ------------------------------------
    //
    // The host page can embed a logged-in user's id directly. If the
    // inbox has an `identity_secret` configured we MUST verify the
    // supplied `identityHmac` before trusting `externalUserId`.
    let identity_secret: Option<&str> = settings.and_then(|s| s.get_str("identity_secret").ok());

    if let Some(ext_id) = body
        .external_user_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        if let Some(secret) = identity_secret {
            let hash = body
                .identity_hmac
                .as_deref()
                .ok_or_else(|| ApiError::Unauthorized("identityHmac required".to_owned()))?;
            if !verify_hmac(secret, ext_id, hash) {
                return Err(ApiError::Unauthorized(
                    "identityHmac verification failed".to_owned(),
                ));
            }
        }
        // If no inbox secret is configured, the host is on the honour
        // system — same trust model as anonymous visitors.
    }

    // ---- Resolve-or-create contact ------------------------------------
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let contacts = mongo.collection::<Document>(CONTACTS_COLL);

    let normalized_email = body
        .email
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty());

    // Build a $or query that matches on either external id or email
    // within this tenant. The contact graph is tenant-scoped.
    let mut or_clauses: Vec<Document> = Vec::new();
    if let Some(ext_id) = body
        .external_user_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        or_clauses.push(doc! {
            "socialIds": { "$elemMatch": {
                "provider": "website",
                "externalId": ext_id,
            }}
        });
    }
    if let Some(email) = normalized_email.as_deref() {
        or_clauses.push(doc! { "emails": email });
    }

    let existing = if or_clauses.is_empty() {
        None
    } else {
        contacts
            .find_one(doc! {
                "tenantId": tenant_oid,
                "$or": Bson::Array(or_clauses.iter().cloned().map(Bson::Document).collect()),
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
            })?
    };

    let contact_oid = match existing {
        Some(c) => c
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing _id")))?,
        None => {
            let new_oid = ObjectId::new();
            let mut new_doc = doc! {
                "_id": new_oid,
                "tenantId": tenant_oid,
                "emails": match normalized_email.as_deref() {
                    Some(e) => Bson::Array(vec![Bson::String(e.to_owned())]),
                    None => Bson::Array(vec![]),
                },
                "phones": Bson::Array(vec![]),
                "socialIds": Bson::Array(vec![]),
                "tags": Bson::Array(vec![]),
                "attrs": Bson::Document(Document::new()),
                "createdAt": now_bson,
                "updatedAt": now_bson,
            };
            if let Some(name) = body.name.as_deref().filter(|s| !s.is_empty()) {
                new_doc.insert("name", name);
            }
            if let Some(ext_id) = body
                .external_user_id
                .as_deref()
                .filter(|s| !s.is_empty())
            {
                new_doc.insert(
                    "socialIds",
                    Bson::Array(vec![Bson::Document(doc! {
                        "provider": "website",
                        "externalId": ext_id,
                    })]),
                );
            }

            contacts.insert_one(new_doc).await.map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
            })?;

            // Audit — `contact_created`.
            audit(
                mongo,
                tenant_oid,
                None,
                Some(new_oid),
                Some(inbox_oid),
                "contact_created",
                None,
            )
            .await?;

            new_oid
        }
    };

    // ---- Open a fresh conversation ------------------------------------
    let conversation_oid = ObjectId::new();
    let convo_doc = doc! {
        "_id": conversation_oid,
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "status": "pending",
        "priority": "medium",
        "labels": Bson::Array(vec![]),
        "sla": Bson::Document(Document::new()),
        "unreadCount": 0i32,
        "customAttrs": Bson::Document(Document::new()),
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .insert_one(convo_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.insert_one"),
            )
        })?;
    audit(
        mongo,
        tenant_oid,
        Some(conversation_oid),
        Some(contact_oid),
        Some(inbox_oid),
        "conversation_created",
        None,
    )
    .await?;

    // ---- Mint + persist session row -----------------------------------
    let token = new_token();
    let session_oid = ObjectId::new();
    let expires_at = now + Duration::days(SESSION_TTL_DAYS);
    let session_doc = doc! {
        "_id": session_oid,
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "conversationId": conversation_oid,
        "visitorToken": &token,
        "expiresAt": bson::DateTime::from_chrono(expires_at),
        "createdAt": now_bson,
    };
    mongo
        .collection::<Document>(SESSIONS_COLL)
        .insert_one(session_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_widget_sessions.insert_one"),
            )
        })?;

    Ok(Json(StartSessionResponse {
        session_id: session_oid.to_hex(),
        visitor_token: token,
        conversation_id: conversation_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        welcome_message: settings_str(settings, "welcomeMessage"),
        team_name: settings_str(settings, "teamName"),
        widget_color: settings_str(settings, "widgetColor"),
    }))
}

// ===========================================================================
// POST /messages — post_message
// ===========================================================================

/// `POST /messages` — append a visitor-authored message.
///
/// Steps:
/// 1. Resolve session by token; touch `expires_at` to extend TTL.
/// 2. Insert the message row (sender_type=Visitor, direction=Inbound).
/// 3. Update the conversation's `last_message_at`, preview, and
///    `unread_count += 1` (agent side); reopen if it was Resolved.
/// 4. Audit `message_sent`.
#[instrument(skip_all)]
pub async fn post_message(
    State(state): State<SabChatWidgetState>,
    Json(body): Json<PostMessageBody>,
) -> Result<Json<PostMessageResponse>> {
    let mongo = &state.mongo;
    let session = resolve_session(mongo, &body.visitor_token).await?;

    // Refresh session expiry — an active chat should never expire
    // mid-conversation.
    let now = Utc::now();
    let new_expiry = now + Duration::days(SESSION_TTL_DAYS);
    touch_session(mongo, session.id, new_expiry).await?;

    // ---- Insert message row -------------------------------------------
    let message_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(now);

    // Lift attachments out of File / Image blocks for fast indexing,
    // mirroring what `sabchat-messages::handlers::append` does.
    let attachments_bson = attachments_for(&body.content);
    let content_bson: Bson = bson::to_bson(&body.content).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("serialize ContentBlock"))
    })?;

    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": session.tenant_id,
        "conversationId": session.conversation_id,
        "inboxId": session.inbox_id,
        "contactId": session.contact_id,
        "senderType": "visitor",
        "senderId": session.contact_id,
        "direction": "inbound",
        "content": content_bson,
        "attachments": attachments_bson,
        "providerMetadata": Bson::Document(Document::new()),
        "private": false,
        "createdAt": now_bson,
    };
    mongo
        .collection::<Document>(MESSAGES_COLL)
        .insert_one(message_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
        })?;

    // ---- Update conversation roll-up ----------------------------------
    //
    // A visitor reply on a resolved thread reopens it as Open — same
    // behaviour as Chatwoot. We always bump unread + last_message_at.
    let preview = preview_for(&body.content);
    let convo_update = doc! {
        "$set": {
            "lastMessageAt": now_bson,
            "lastMessagePreview": &preview,
            "updatedAt": now_bson,
            "status": "open",
        },
        "$inc": { "unreadCount": 1i32 },
    };
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(doc! { "_id": session.conversation_id }, convo_update)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one"),
            )
        })?;

    audit(
        mongo,
        session.tenant_id,
        Some(session.conversation_id),
        Some(session.contact_id),
        Some(session.inbox_id),
        "message_sent",
        Some(message_oid),
    )
    .await?;

    Ok(Json(PostMessageResponse {
        message_id: message_oid.to_hex(),
        created_at: now.to_rfc3339(),
    }))
}

// ===========================================================================
// GET /history — fetch_history
// ===========================================================================

/// `GET /history` — newest-first paginated message history scoped to
/// the session's conversation. Only public messages (`private == false`)
/// are surfaced — internal agent notes stay hidden from the visitor.
#[instrument(skip_all)]
pub async fn fetch_history(
    State(state): State<SabChatWidgetState>,
    Query(query): Query<FetchHistoryQuery>,
) -> Result<Json<FetchHistoryResponse>> {
    let mongo = &state.mongo;
    let session = resolve_session(mongo, &query.visitor_token).await?;

    let limit = query.limit.clamp(1, HISTORY_MAX_LIMIT);

    let mut filter = doc! {
        "conversationId": session.conversation_id,
        "private": false,
    };
    if let Some(before) = query.before_id.as_deref().filter(|s| !s.is_empty()) {
        let before_oid = oid_from_str(before)?;
        filter.insert("_id", doc! { "$lt": before_oid });
    }

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let cursor = mongo
        .collection::<Document>(MESSAGES_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect"))
    })?;

    let has_more = (docs.len() as i64) >= limit;
    let messages: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    Ok(Json(FetchHistoryResponse { messages, has_more }))
}

// ===========================================================================
// POST /end — end_session
// ===========================================================================

/// `POST /end` — visitor-initiated resolve. Transitions the
/// conversation to `Resolved` only when it is currently `Open` or
/// `Pending`; already-snoozed or already-resolved threads are
/// untouched. Audit `conversation_resolved` on every transition.
#[instrument(skip_all)]
pub async fn end_session(
    State(state): State<SabChatWidgetState>,
    Json(body): Json<EndSessionBody>,
) -> Result<Json<SuccessResponse>> {
    let mongo = &state.mongo;
    let session = resolve_session(mongo, &body.visitor_token).await?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    // Guard the transition by `status` so re-calls are idempotent and
    // don't keep stamping `resolved_at`.
    let update = doc! {
        "$set": {
            "status": "resolved",
            "resolvedAt": now_bson,
            "updatedAt": now_bson,
        },
    };
    let res = mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! {
                "_id": session.conversation_id,
                "status": { "$in": ["open", "pending"] },
            },
            update,
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(resolve)"),
            )
        })?;

    if res.modified_count > 0 {
        audit(
            mongo,
            session.tenant_id,
            Some(session.conversation_id),
            Some(session.contact_id),
            Some(session.inbox_id),
            "conversation_resolved",
            None,
        )
        .await?;
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Extract attachment refs out of a content block so they can be
/// projected into the message's `attachments` array (fast index for
/// gallery / search). Mirrors `sabchat-messages` behaviour.
fn attachments_for(block: &ContentBlock) -> Bson {
    let atts: Vec<&Attachment> = match block {
        ContentBlock::File { attachment } => vec![attachment],
        _ => Vec::new(),
    };
    let arr: Vec<Bson> = atts
        .into_iter()
        .map(|a| bson::to_bson(a).unwrap_or(Bson::Null))
        .collect();
    Bson::Array(arr)
}

/// Pull a non-empty string out of `channel_config.settings`. Helper for
/// the start_session response builder.
fn settings_str(settings: Option<&Document>, key: &str) -> Option<String> {
    settings
        .and_then(|s| s.get_str(key).ok())
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// Persist one row in `sabchat_audit_log`. Visitor-initiated audit
/// rows always carry `actor_type = "visitor"` and have no actor id
/// (the visitor is a contact, not a user).
async fn audit(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_id: Option<ObjectId>,
    contact_id: Option<ObjectId>,
    inbox_id: Option<ObjectId>,
    action: &str,
    message_id: Option<ObjectId>,
) -> Result<()> {
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_id,
        "action": action,
        "actorType": "visitor",
        "before": Bson::Document(Document::new()),
        "after": Bson::Document(Document::new()),
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(c) = conversation_id {
        doc.insert("conversationId", c);
    }
    if let Some(c) = contact_id {
        doc.insert("contactId", c);
    }
    if let Some(i) = inbox_id {
        doc.insert("inboxId", i);
    }
    if let Some(m) = message_id {
        doc.insert("messageId", m);
    }

    mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.insert_one"))
        })?;
    Ok(())
}

