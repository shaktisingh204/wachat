//! HTTP handlers for the email-inbox surface.
//!
//! Conventions (mirrored from `wachat-broadcast::handlers`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes [`AuthUser`] — there is no anonymous access.
//! - Every Mongo query is scoped by
//!   `userId == oid_from_str(&user.tenant_id)?` so a tenant can never
//!   see another tenant's threads / messages / assignments.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{
    bson_helpers::{document_to_clean_json, oid_from_str},
    mongo::MongoHandle,
};
use serde_json::Value;
use tracing::{instrument, warn};

use crate::dto::{
    AssignThreadBody, AssignThreadResponse, AssignmentsListResponse, BulkUpdateResponse,
    BulkUpdateThreadsBody, ListMessagesQuery, ListThreadsQuery, MessageListResponse, OkResponse,
    SendReplyBody, SendReplyResponse, ThreadDetailQuery, ThreadDetailResponse, ThreadListResponse,
    UpdateThreadBody,
};
use crate::state::EmailInboxState;

/// Mongo collection names — kept inline (not in a separate `consts`
/// module) because they're only used here.
const THREADS_COLL: &str = "email_threads";
const MESSAGES_COLL: &str = "email_messages";
const ASSIGNMENTS_COLL: &str = "email_assignments";

// ===========================================================================
// Helpers
// ===========================================================================

/// Resolve the calling tenant's `userId` from the JWT.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

/// Load a thread by id, scoped to the caller's tenant. Returns 404 (not
/// 403) when the doc isn't found so cross-tenant probes can't tell
/// "exists for another tenant" from "doesn't exist".
async fn load_thread_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    thread_id_hex: &str,
) -> Result<Document> {
    let thread_oid = oid_from_str(thread_id_hex)?;
    let user_oid = tenant_oid(user)?;
    let coll = mongo.collection::<Document>(THREADS_COLL);
    coll.find_one(doc! { "_id": thread_oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("thread {thread_id_hex}")))
}

// ===========================================================================
// GET /threads — list with filters
// ===========================================================================

/// `GET /threads?status=&unread=&starred=&assignedTo=&accountId=&label=&q=&page=&limit=`
///
/// Lists threads for the calling tenant. Sort order is `lastMessageAt`
/// descending (newest activity first) — matches the Mailchimp inbox.
#[instrument(skip_all)]
pub async fn list_threads(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Query(q): Query<ListThreadsQuery>,
) -> Result<Json<ThreadListResponse>> {
    let user_oid = tenant_oid(&user)?;
    let mut filter = doc! { "userId": user_oid };

    if let Some(status) = q.status.as_deref() {
        if !status.is_empty() {
            filter.insert("status", status);
        }
    }
    if let Some(unread) = q.unread {
        filter.insert("unread", unread);
    }
    if let Some(starred) = q.starred {
        filter.insert("starred", starred);
    }
    if let Some(assigned) = q.assigned_to.as_deref() {
        if !assigned.is_empty() {
            filter.insert("assignedTo", oid_from_str(assigned)?);
        }
    }
    if let Some(account) = q.account_id.as_deref() {
        if !account.is_empty() {
            filter.insert("accountId", oid_from_str(account)?);
        }
    }
    if let Some(label) = q.label.as_deref() {
        if !label.is_empty() {
            filter.insert("labels", label);
        }
    }
    if let Some(needle) = q.q.as_deref() {
        let n = needle.trim();
        if !n.is_empty() {
            // Mongo regex is anchored to the value; escape the pattern
            // so user-supplied special chars don't trip up the match.
            let escaped = regex_escape(n);
            filter.insert(
                "$or",
                vec![
                    doc! { "subject": { "$regex": &escaped, "$options": "i" } },
                    doc! { "lastMessagePreview": { "$regex": &escaped, "$options": "i" } },
                ],
            );
        }
    }

    let limit = q.limit.clamp(1, 200);
    let skip = q.page.saturating_sub(1) * limit;
    let opts = FindOptions::builder()
        .sort(doc! { "lastMessageAt": -1 })
        .skip(skip)
        .limit(limit as i64)
        .build();

    let coll = state.mongo.collection::<Document>(THREADS_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.count")))?;

    let threads = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ThreadListResponse { threads, total }))
}

// ===========================================================================
// GET /threads/{id}
// ===========================================================================

/// `GET /threads/{thread_id}?limit=` — thread document plus the most
/// recent `limit` messages (newest first), for the inbox detail pane.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn get_thread(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
    Query(q): Query<ThreadDetailQuery>,
) -> Result<Json<ThreadDetailResponse>> {
    let thread_doc = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;

    let limit = q.limit.clamp(1, 200);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(limit as i64)
        .build();
    let msgs_coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let cursor = msgs_coll
        .find(doc! { "threadId": thread_oid, "userId": user_oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.find")))?;
    let msg_docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.collect")))?;

    let messages = msg_docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ThreadDetailResponse {
        thread: document_to_clean_json(thread_doc),
        messages,
    }))
}

// ===========================================================================
// GET /threads/{id}/messages
// ===========================================================================

/// `GET /threads/{thread_id}/messages?page=&limit=` — paginated message
/// list for a single thread, sorted oldest-first to render the
/// conversation top-down.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn list_messages(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
    Query(q): Query<ListMessagesQuery>,
) -> Result<Json<MessageListResponse>> {
    // Tenancy check via thread lookup; we don't need the doc, just the
    // guard.
    let _thread = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;

    let limit = q.limit.clamp(1, 200);
    let skip = q.page.saturating_sub(1) * limit;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit as i64)
        .build();

    let filter = doc! { "threadId": thread_oid, "userId": user_oid };
    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.count")))?;

    let messages = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(MessageListResponse { messages, total }))
}

// ===========================================================================
// PATCH /threads/{id}
// ===========================================================================

/// `PATCH /threads/{thread_id}` — partial update of status / starred /
/// labels / unread / assignedTo / slaDueAt.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn update_thread(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
    Json(body): Json<UpdateThreadBody>,
) -> Result<Json<OkResponse>> {
    // Tenancy guard.
    let _existing = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;

    let mut set = Document::new();
    if let Some(status) = body.status.as_deref() {
        validate_thread_status(status)?;
        set.insert("status", status);
    }
    if let Some(unread) = body.unread {
        set.insert("unread", unread);
    }
    if let Some(starred) = body.starred {
        set.insert("starred", starred);
    }
    if let Some(labels) = body.labels.as_ref() {
        set.insert(
            "labels",
            Bson::Array(labels.iter().map(|s| Bson::String(s.clone())).collect()),
        );
    }
    if let Some(assigned) = body.assigned_to.as_deref() {
        if assigned.is_empty() {
            set.insert("assignedTo", Bson::Null);
        } else {
            set.insert("assignedTo", oid_from_str(assigned)?);
        }
    }
    if let Some(sla) = body.sla_due_at.as_deref() {
        let parsed: DateTime<Utc> = DateTime::parse_from_rfc3339(sla)
            .map_err(|e| ApiError::BadRequest(format!("invalid slaDueAt: {e}")))?
            .with_timezone(&Utc);
        set.insert("slaDueAt", bson::DateTime::from_chrono(parsed));
    }

    if set.is_empty() {
        return Err(ApiError::Validation(
            "no updatable fields provided".to_owned(),
        ));
    }
    set.insert("updatedAt", bson::DateTime::from_chrono(Utc::now()));

    let coll = state.mongo.collection::<Document>(THREADS_COLL);
    coll.update_one(
        doc! { "_id": thread_oid, "userId": user_oid },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.update_one")))?;

    Ok(Json(OkResponse { ok: true }))
}

fn validate_thread_status(s: &str) -> Result<()> {
    match s {
        "open" | "pending" | "closed" | "archived" => Ok(()),
        other => Err(ApiError::BadRequest(format!(
            "invalid status `{other}` (expected open|pending|closed|archived)"
        ))),
    }
}

// ===========================================================================
// POST /threads/bulk
// ===========================================================================

/// `POST /threads/bulk` — bulk status / read / star update across many
/// threads. All updates are tenant-scoped.
#[instrument(skip_all, fields(action = %body.action))]
pub async fn bulk_update_threads(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Json(body): Json<BulkUpdateThreadsBody>,
) -> Result<Json<BulkUpdateResponse>> {
    if body.thread_ids.is_empty() {
        return Err(ApiError::Validation("threadIds must be non-empty".into()));
    }
    let user_oid = tenant_oid(&user)?;
    let oids: Vec<ObjectId> = body
        .thread_ids
        .iter()
        .map(|s| oid_from_str(s))
        .collect::<Result<Vec<_>>>()?;

    let set = match body.action.as_str() {
        "archive" => doc! { "status": "archived" },
        "close" => doc! { "status": "closed" },
        "reopen" => doc! { "status": "open" },
        "mark-read" => doc! { "unread": false },
        "mark-unread" => doc! { "unread": true },
        "star" => doc! { "starred": true },
        "unstar" => doc! { "starred": false },
        other => {
            return Err(ApiError::BadRequest(format!(
                "unknown bulk action `{other}`"
            )));
        }
    };
    let mut set = set;
    set.insert("updatedAt", bson::DateTime::from_chrono(Utc::now()));

    let coll = state.mongo.collection::<Document>(THREADS_COLL);
    let res = coll
        .update_many(
            doc! { "_id": { "$in": oids }, "userId": user_oid },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("threads.bulk_update")))?;

    Ok(Json(BulkUpdateResponse {
        updated: res.modified_count,
    }))
}

// ===========================================================================
// POST /threads/{id}/messages — send reply (SMTP deferred)
// ===========================================================================

/// `POST /threads/{thread_id}/messages` — persist an outbound reply.
///
/// Provider dispatch (SMTP / Mailgun / SES) is deferred to a future
/// `email-sender` worker; for now we only persist the row, update the
/// thread preview, and emit a tracing warn so the gap is observable.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn send_reply(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
    Json(body): Json<SendReplyBody>,
) -> Result<Json<SendReplyResponse>> {
    let thread = load_thread_for(&user, &state.mongo, &thread_id).await?;
    if body.to.is_empty() {
        return Err(ApiError::Validation(
            "at least one `to` recipient is required".into(),
        ));
    }
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;
    let sent_by_oid = oid_from_str(&user.user_id)?;

    let subject = body.subject.clone().unwrap_or_else(|| {
        let thread_subject = thread.get_str("subject").unwrap_or("(no subject)");
        if thread_subject.to_ascii_lowercase().starts_with("re:") {
            thread_subject.to_owned()
        } else {
            format!("Re: {thread_subject}")
        }
    });

    let preview = build_preview(body.body_text.as_deref(), &body.body_html);

    let message_oid = ObjectId::new();
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    let to_arr = recipients_to_bson(&body.to);
    let cc_arr = recipients_to_bson(&body.cc);
    let bcc_arr = recipients_to_bson(&body.bcc);
    let attachments_arr = Bson::Array(
        body.attachments
            .iter()
            .map(|a| {
                Bson::Document(doc! {
                    "filename": &a.filename,
                    "contentType": &a.content_type,
                    "size": a.size,
                    "url": &a.url,
                })
            })
            .collect(),
    );

    let mut from = Document::new();
    // The thread doc's first participant marked as the "owner side"
    // mailbox is the canonical from address; we fall back to the first
    // participant overall. The TS layer can override by setting
    // `email_settings.fromEmail` once the sender phase lands.
    if let Ok(participants) = thread.get_array("participants") {
        if let Some(Bson::Document(p)) = participants.first() {
            if let Ok(email) = p.get_str("email") {
                from.insert("email", email);
            }
            if let Ok(name) = p.get_str("name") {
                from.insert("name", name);
            }
        }
    }
    if !from.contains_key("email") {
        from.insert("email", "noreply@sabnode.local");
    }

    let mut message_doc = doc! {
        "_id": message_oid,
        "userId": user_oid,
        "threadId": thread_oid,
        "direction": "outbound",
        "from": from,
        "to": to_arr,
        "cc": cc_arr,
        "bcc": bcc_arr,
        "subject": &subject,
        "bodyHtml": &body.body_html,
        "attachments": attachments_arr,
        "sentBy": sent_by_oid,
        "createdAt": now_bson,
    };
    if let Some(text) = body.body_text.as_deref() {
        message_doc.insert("bodyText", text);
    }

    let msgs = state.mongo.collection::<Document>(MESSAGES_COLL);
    msgs.insert_one(message_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.insert_one")))?;

    // Bump thread preview / counters.
    let threads = state.mongo.collection::<Document>(THREADS_COLL);
    threads
        .update_one(
            doc! { "_id": thread_oid, "userId": user_oid },
            doc! {
                "$set": {
                    "lastMessageAt": now_bson,
                    "lastMessagePreview": preview,
                    "unread": false,
                    "updatedAt": now_bson,
                },
                "$inc": { "messageCount": 1_i64 },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("threads.update_after_reply"))
        })?;

    // Provider dispatch is owned by the future email-sender worker.
    warn!(
        thread_id = %thread_id,
        message_id = %message_oid.to_hex(),
        "send not yet wired — outbound message persisted but SMTP / provider dispatch is deferred"
    );

    Ok(Json(SendReplyResponse {
        message_id: message_oid.to_hex(),
    }))
}

fn recipients_to_bson(addrs: &[crate::dto::RecipientDto]) -> Bson {
    Bson::Array(
        addrs
            .iter()
            .map(|r| {
                let mut d = doc! { "email": &r.email };
                if let Some(name) = r.name.as_deref() {
                    d.insert("name", name);
                }
                Bson::Document(d)
            })
            .collect(),
    )
}

/// Build a short (max 280-char) preview line from the reply body. Prefer
/// the plain-text body when present; otherwise strip HTML tags from the
/// HTML body.
fn build_preview(body_text: Option<&str>, body_html: &str) -> String {
    let raw = match body_text {
        Some(t) if !t.trim().is_empty() => t.to_owned(),
        _ => strip_html(body_html),
    };
    let collapsed = collapse_whitespace(&raw);
    if collapsed.chars().count() <= 280 {
        collapsed
    } else {
        collapsed.chars().take(280).collect::<String>() + "…"
    }
}

/// Naive HTML stripper — drops anything between `<` and `>`. Good
/// enough for an inbox preview line; full sanitisation is the renderer's
/// job, not ours.
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_was_space = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !last_was_space {
                out.push(' ');
                last_was_space = true;
            }
        } else {
            out.push(ch);
            last_was_space = false;
        }
    }
    out.trim().to_owned()
}

/// Tiny regex-metacharacter escape so user-supplied search needles can't
/// inject a Mongo `$regex` pattern. Matches the characters the Rust
/// `regex` crate documents as meta.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for ch in s.chars() {
        if matches!(
            ch,
            '\\' | '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$'
        ) {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

// ===========================================================================
// POST /threads/{id}/assign — create assignment
// ===========================================================================

/// `POST /threads/{thread_id}/assign` — claim a thread for a user.
/// Records an `email_assignments` doc and stamps `assignedTo` on the
/// thread. The previous assignment (if any) gets a `releasedAt`.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn assign_thread(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
    Json(body): Json<AssignThreadBody>,
) -> Result<Json<AssignThreadResponse>> {
    let _thread = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;
    let assigned_to_oid = oid_from_str(&body.assigned_to)?;
    let assigned_by_oid = oid_from_str(&user.user_id)?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    // Release any open assignments first (no releasedAt yet).
    let assignments = state.mongo.collection::<Document>(ASSIGNMENTS_COLL);
    assignments
        .update_many(
            doc! {
                "threadId": thread_oid,
                "userId": user_oid,
                "releasedAt": { "$exists": false },
            },
            doc! { "$set": { "releasedAt": now_bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("assignments.release_prev"))
        })?;

    let assignment_oid = ObjectId::new();
    let assignment_doc = doc! {
        "_id": assignment_oid,
        "userId": user_oid,
        "threadId": thread_oid,
        "assignedTo": assigned_to_oid,
        "assignedBy": assigned_by_oid,
        "assignedAt": now_bson,
    };
    assignments
        .insert_one(assignment_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("assignments.insert_one")))?;

    let threads = state.mongo.collection::<Document>(THREADS_COLL);
    threads
        .update_one(
            doc! { "_id": thread_oid, "userId": user_oid },
            doc! { "$set": {
                "assignedTo": assigned_to_oid,
                "updatedAt": now_bson,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("threads.update_assigned_to"))
        })?;

    Ok(Json(AssignThreadResponse {
        assignment_id: assignment_oid.to_hex(),
    }))
}

// ===========================================================================
// DELETE /threads/{thread_id}/assignments/{assignment_id}
// ===========================================================================

/// `DELETE /threads/{thread_id}/assignments/{assignment_id}` — release a
/// specific assignment. Stamps `releasedAt` (we never hard-delete
/// assignments — they're audit history) and clears `assignedTo` on the
/// thread iff this assignment was the active one.
#[instrument(skip_all, fields(thread_id = %thread_id, assignment_id = %assignment_id))]
pub async fn release_assignment(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path((thread_id, assignment_id)): Path<(String, String)>,
) -> Result<Json<OkResponse>> {
    let _thread = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;
    let assignment_oid = oid_from_str(&assignment_id)?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let assignments = state.mongo.collection::<Document>(ASSIGNMENTS_COLL);
    let res = assignments
        .update_one(
            doc! {
                "_id": assignment_oid,
                "threadId": thread_oid,
                "userId": user_oid,
            },
            doc! { "$set": { "releasedAt": now_bson } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("assignments.release")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!(
            "assignment {assignment_id} on thread {thread_id}"
        )));
    }

    // If this assignment was the current `assignedTo` on the thread,
    // clear it.
    let threads = state.mongo.collection::<Document>(THREADS_COLL);
    let assignment_doc = assignments
        .find_one(doc! { "_id": assignment_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("assignments.find_after_release"))
        })?;
    if let Some(a) = assignment_doc {
        if let Ok(assigned_to_oid) = a.get_object_id("assignedTo") {
            threads
                .update_one(
                    doc! {
                        "_id": thread_oid,
                        "userId": user_oid,
                        "assignedTo": assigned_to_oid,
                    },
                    doc! { "$set": { "assignedTo": Bson::Null, "updatedAt": now_bson } },
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("threads.clear_assigned_to"))
                })?;
        }
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// GET /threads/{thread_id}/assignments
// ===========================================================================

/// `GET /threads/{thread_id}/assignments` — full assignment history for
/// the thread (newest first). Active assignments (`releasedAt` absent)
/// sort to the top because their `assignedAt` is most recent.
#[instrument(skip_all, fields(thread_id = %thread_id))]
pub async fn list_assignments(
    user: AuthUser,
    State(state): State<EmailInboxState>,
    Path(thread_id): Path<String>,
) -> Result<Json<AssignmentsListResponse>> {
    let _thread = load_thread_for(&user, &state.mongo, &thread_id).await?;
    let thread_oid = oid_from_str(&thread_id)?;
    let user_oid = tenant_oid(&user)?;

    let opts = FindOptions::builder()
        .sort(doc! { "assignedAt": -1 })
        .limit(200)
        .build();
    let coll = state.mongo.collection::<Document>(ASSIGNMENTS_COLL);
    let cursor = coll
        .find(doc! { "threadId": thread_oid, "userId": user_oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("assignments.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("assignments.collect")))?;
    let out: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(AssignmentsListResponse { assignments: out }))
}
