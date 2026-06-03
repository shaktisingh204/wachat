//! HTTP handlers for `/v1/telegram/broadcasts`.
//!
//! ## Status machine
//!
//! ```text
//!  draft ──┬──► scheduled ──► sending ──► completed
//!          │                      │
//!          ├──► sending ──────────┘
//!          │
//!          └──► (delete / cancel)
//!
//!  Any non-terminal state can transition to `cancelled` via /cancel.
//!  Any active state can land in `failed` if dispatch blows up.
//! ```
//!
//! ## Ownership / multi-tenancy
//!
//! Every endpoint either receives `projectId` explicitly (queries, create,
//! mutation bodies) or resolves it from the broadcast doc. We always check
//! that the project belongs to the calling user via [`require_project`].
//! This mirrors the pattern in `telegram-ads`.
//!
//! ## Dispatch
//!
//! Send / schedule push a `pendingDispatch` marker into Mongo and emit a
//! `tracing` event. A separate worker (out of scope for this slice) will
//! pop those markers and do the actual fan-out. The legacy `send_now`
//! path still does a synchronous in-process fan-out for backwards
//! compatibility with the existing UI — see the inline comment in
//! [`send_now`].

use axum::{
    Json,
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Datelike, TimeZone, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use telegram_bots::bot_api::SendMessageParams;

use crate::dto::{
    AckResult, AnalyticsDayRow, AnalyticsErrorRow, AnalyticsQuery, AnalyticsResp, BroadcastRow,
    CreateBody, DeliveriesQuery, DeliveriesResp, DeliveryRow, GetResp, ListQuery, ListResp,
    ProjectScopedBody, ProjectScopedQuery, ScheduleBody, TestSendBody, UpdateBody,
};
use crate::state::TelegramBroadcastsState;

// ---------------------------------------------------------------------------
//  Collection names
// ---------------------------------------------------------------------------

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHATS: &str = "telegram_chats";
const BROADCASTS: &str = "telegram_broadcasts";
const DELIVERIES: &str = "telegram_broadcast_deliveries";
const PENDING: &str = "telegram_broadcast_pending";

// Status constants — lowercase canonical form. Legacy docs may carry
// uppercase values (DRAFT/SENT) so we normalise on read.
const ST_DRAFT: &str = "draft";
const ST_SCHEDULED: &str = "scheduled";
const ST_SENDING: &str = "sending";
const ST_COMPLETED: &str = "completed";
const ST_FAILED: &str = "failed";
const ST_CANCELLED: &str = "cancelled";

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}
fn dt_or_now(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}
fn dt_opt(o: Option<bson::DateTime>) -> Option<chrono::DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

/// Verify the project belongs to the calling user.
async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

/// Fetch a bot doc and verify the calling user owns the parent project.
async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

/// Fetch a broadcast and verify the caller's project ownership.
async fn require_broadcast(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
    broadcast_id_hex: &str,
) -> Result<(ObjectId, Document), String> {
    let project_oid = require_project(user, mongo, project_id).await?;
    let bid = parse_oid(broadcast_id_hex).ok_or_else(|| "invalid broadcast id".to_owned())?;
    let bdoc = mongo
        .collection::<Document>(BROADCASTS)
        .find_one(doc! { "_id": bid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Broadcast not found.".to_owned())?;
    Ok((project_oid, bdoc))
}

/// Normalise legacy uppercase statuses (e.g. "DRAFT", "SENT") to the
/// canonical lowercase form spelled out in the public API.
fn normalise_status(raw: &str) -> String {
    match raw.to_ascii_uppercase().as_str() {
        "DRAFT" => ST_DRAFT.to_owned(),
        "QUEUED" | "SCHEDULED" => ST_SCHEDULED.to_owned(),
        "SENDING" => ST_SENDING.to_owned(),
        "SENT" | "COMPLETED" => ST_COMPLETED.to_owned(),
        "FAILED" => ST_FAILED.to_owned(),
        "CANCELLED" | "CANCELED" => ST_CANCELLED.to_owned(),
        _ => raw.to_owned(),
    }
}

fn bson_to_json(d: &Document) -> Value {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    serde_json::from_value(raw).unwrap_or(Value::Null)
}

fn doc_to_row(d: &Document) -> Option<BroadcastRow> {
    let v = bson_to_json(d);
    Some(BroadcastRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d
            .get_object_id("projectId")
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        status: normalise_status(d.get_str("status").unwrap_or("draft")),
        audience: v.get("audience").cloned().unwrap_or(Value::Null),
        message: v.get("message").cloned().unwrap_or(Value::Null),
        media: v.get("media").cloned().unwrap_or(Value::Array(vec![])),
        inline_keyboard: v
            .get("inlineKeyboard")
            .cloned()
            .unwrap_or(Value::Array(vec![])),
        stats: v.get("stats").cloned().unwrap_or(Value::Null),
        counters: v.get("counters").cloned().unwrap_or_else(|| {
            // Fall back to legacy `stats` field when `counters` is absent.
            v.get("stats").cloned().unwrap_or(Value::Null)
        }),
        error_summary: v.get("errorSummary").cloned(),
        scheduled_at: dt_opt(d.get_datetime("scheduledAt").ok().copied()),
        started_at: dt_opt(d.get_datetime("startedAt").ok().copied()),
        completed_at: dt_opt(d.get_datetime("completedAt").ok().copied()),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt_or_now(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn delivery_to_row(d: &Document) -> Option<DeliveryRow> {
    Some(DeliveryRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        chat_id: d
            .get_str("chatId")
            .ok()
            .map(str::to_owned)
            .or_else(|| d.get_i64("chatId").ok().map(|n| n.to_string()))
            .or_else(|| d.get_i32("chatId").ok().map(|n| n.to_string()))
            .unwrap_or_default(),
        status: d.get_str("status").unwrap_or("").to_owned(),
        error_code: d
            .get_i64("errorCode")
            .ok()
            .or_else(|| d.get_i32("errorCode").ok().map(i64::from)),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        sent_at: dt_opt(d.get_datetime("sentAt").ok().copied()),
    })
}

// ---------------------------------------------------------------------------
//  GET / — list (paginated)
// ---------------------------------------------------------------------------

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            // Legacy clients still pass botId only — fall back to the
            // older behaviour by resolving the project from the bot.
            if let Some(bid) = q.bot_id.as_deref().filter(|s| !s.is_empty()) {
                return list_legacy_by_bot(user, s, bid).await;
            }
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "projectId": project_oid };
    if let Some(bid) = q.bot_id.as_deref().and_then(parse_oid) {
        filter.insert("botId", bid);
    }
    if let Some(status) = q.status.as_deref().filter(|s| !s.is_empty()) {
        // Accept both lowercase + uppercase legacy values so the API is
        // backwards-compatible.
        let lower = status.to_ascii_lowercase();
        let upper = status.to_ascii_uppercase();
        filter.insert(
            "status",
            doc! { "$in": [bson::Bson::String(lower), bson::Bson::String(upper)] },
        );
    }
    if let Some(search) = q.search.as_deref().filter(|s| !s.is_empty()) {
        // Case-insensitive prefix-ish contains match. We escape Mongo
        // regex meta-chars defensively.
        let escaped = regex_escape(search);
        filter.insert("name", doc! { "$regex": escaped, "$options": "i" });
    }
    if let Some(cursor) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": cursor });
    }

    let coll = s.mongo.collection::<Document>(BROADCASTS);
    let cursor_res = coll
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await;
    let cursor = match cursor_res {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let next_cursor = if docs.len() as i64 == limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok().map(|o| o.to_hex()))
    } else {
        None
    };
    let broadcasts = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp {
        broadcasts,
        next_cursor,
        error: None,
    })
}

/// Legacy path used by older clients that only supply `botId`.
///
/// Behaves identically to the pre-slice list — looks up the bot, then
/// lists broadcasts under it. Kept so we don't break callers during the
/// front-end roll-out.
async fn list_legacy_by_bot(
    user: AuthUser,
    s: TelegramBroadcastsState,
    bot_id: &str,
) -> Json<ListResp> {
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let coll = s.mongo.collection::<Document>(BROADCASTS);
    let cursor = match coll
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(ListResp {
        broadcasts: docs.iter().filter_map(doc_to_row).collect(),
        next_cursor: None,
        error: None,
    })
}

/// Minimal regex escaper for the subset of meta-chars we care about.
/// Mongo regex syntax is PCRE-ish so we play safe.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}

// ---------------------------------------------------------------------------
//  POST / — create (draft)
// ---------------------------------------------------------------------------

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    // Belt-and-braces: ensure the bot really lives under the named project.
    if bot.get_object_id("projectId").ok() != Some(project_oid) {
        return err("Bot does not belong to this project.");
    }
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };

    let now = bson::DateTime::now();
    // Create always lands in `draft`, regardless of scheduledAt — the
    // explicit `/schedule` endpoint is the only way to move into the
    // `scheduled` state.
    let status = ST_DRAFT;

    let audience_doc = bson::to_document(&body.audience).unwrap_or_default();
    let message_doc = bson::to_document(&body.message).unwrap_or_default();
    let media_doc = body
        .media
        .as_ref()
        .map(|m| bson::to_bson(m).unwrap_or(bson::Bson::Array(vec![])))
        .unwrap_or(bson::Bson::Array(vec![]));
    let keyboard_doc = body
        .inline_keyboard
        .as_ref()
        .map(|m| bson::to_bson(m).unwrap_or(bson::Bson::Array(vec![])))
        .unwrap_or(bson::Bson::Array(vec![]));

    let mut d = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "userId": user_oid,
        "name": body.name.trim(),
        "audience": audience_doc,
        "message": message_doc,
        "media": media_doc,
        "inlineKeyboard": keyboard_doc,
        "status": status,
        "counters": doc! {
            "queued": 0i64,
            "sent": 0i64,
            "failed": 0i64,
            "skipped": 0i64,
        },
        // Legacy field kept in lock-step with `counters` for clients that
        // still read `stats`.
        "stats": doc! { "total": 0i64, "sent": 0i64, "failed": 0i64 },
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(sched) = body.scheduled_at {
        d.insert("scheduledAt", bson::DateTime::from_chrono(sched));
    }

    let coll = s.mongo.collection::<Document>(BROADCASTS);
    let res = match coll.insert_one(d).await {
        Ok(r) => r,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let id = res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default();

    Json(AckResult {
        success: true,
        message: Some("Broadcast created.".to_owned()),
        broadcast_id: Some(id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  GET /{id}
// ---------------------------------------------------------------------------

pub async fn get_one(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<GetResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(GetResp {
                broadcast: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    match require_broadcast(&user, &s.mongo, project_id, &broadcast_id).await {
        Ok((_, doc)) => Json(GetResp {
            broadcast: doc_to_row(&doc),
            error: None,
        }),
        Err(e) => Json(GetResp {
            broadcast: None,
            error: Some(e),
        }),
    }
}

// ---------------------------------------------------------------------------
//  PATCH /{id} — only when draft
// ---------------------------------------------------------------------------

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Json<AckResult> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let (project_oid, bdoc) =
        match require_broadcast(&user, &s.mongo, project_id, &broadcast_id).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };
    let status = normalise_status(bdoc.get_str("status").unwrap_or(ST_DRAFT));
    if status != ST_DRAFT {
        return err("Only draft broadcasts can be edited.");
    }
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };

    let mut set = doc! { "updatedAt": bson::DateTime::now() };
    if let Some(name) = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", name);
    }
    if let Some(bot_id) = body.bot_id.as_deref() {
        let bot = match require_bot(&user, &s.mongo, bot_id).await {
            Ok(b) => b,
            Err(e) => return err(e),
        };
        let bot_oid = match bot.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => return err("Bot not found."),
        };
        if bot.get_object_id("projectId").ok() != Some(project_oid) {
            return err("Bot does not belong to this project.");
        }
        set.insert("botId", bot_oid);
    }
    if let Some(audience) = body.audience.as_ref() {
        set.insert("audience", bson::to_document(audience).unwrap_or_default());
    }
    if let Some(message) = body.message.as_ref() {
        set.insert("message", bson::to_document(message).unwrap_or_default());
    }
    if let Some(media) = body.media.as_ref() {
        set.insert(
            "media",
            bson::to_bson(media).unwrap_or(bson::Bson::Array(vec![])),
        );
    }
    if let Some(keyboard) = body.inline_keyboard.as_ref() {
        set.insert(
            "inlineKeyboard",
            bson::to_bson(keyboard).unwrap_or(bson::Bson::Array(vec![])),
        );
    }
    if let Some(sched) = body.scheduled_at {
        set.insert("scheduledAt", bson::DateTime::from_chrono(sched));
    }

    let coll = s.mongo.collection::<Document>(BROADCASTS);
    match coll
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Broadcast not found."),
        Ok(_) => Json(AckResult {
            success: true,
            broadcast_id: Some(broadcast_id),
            message: Some("Saved.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  DELETE /{id}
// ---------------------------------------------------------------------------

pub async fn delete_one(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };
    let coll = s.mongo.collection::<Document>(BROADCASTS);
    match coll
        .delete_one(doc! { "_id": bid, "projectId": project_oid })
        .await
    {
        Ok(_) => {
            // Best-effort cleanup of side tables.
            let _ = s
                .mongo
                .collection::<Document>(DELIVERIES)
                .delete_many(doc! { "broadcastId": bid })
                .await;
            let _ = s
                .mongo
                .collection::<Document>(PENDING)
                .delete_many(doc! { "broadcastId": bid })
                .await;
            Json(AckResult {
                success: true,
                broadcast_id: Some(broadcast_id),
                message: Some("Deleted.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  POST /{id}/duplicate
// ---------------------------------------------------------------------------

pub async fn duplicate(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<ProjectScopedBody>,
) -> Json<AckResult> {
    let (_project_oid, src) =
        match require_broadcast(&user, &s.mongo, &body.project_id, &broadcast_id).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };

    let now = bson::DateTime::now();
    let mut dup = src.clone();
    dup.remove("_id");
    dup.remove("scheduledAt");
    dup.remove("startedAt");
    dup.remove("completedAt");
    dup.remove("errorSummary");
    dup.insert("status", ST_DRAFT);
    dup.insert(
        "counters",
        doc! {
            "queued": 0i64,
            "sent": 0i64,
            "failed": 0i64,
            "skipped": 0i64,
        },
    );
    dup.insert(
        "stats",
        doc! { "total": 0i64, "sent": 0i64, "failed": 0i64 },
    );
    let new_name = format!(
        "{} (copy)",
        src.get_str("name").unwrap_or("Untitled broadcast")
    );
    dup.insert("name", new_name);
    dup.insert("createdAt", now);
    dup.insert("updatedAt", now);

    let coll = s.mongo.collection::<Document>(BROADCASTS);
    match coll.insert_one(dup).await {
        Ok(res) => Json(AckResult {
            success: true,
            broadcast_id: res.inserted_id.as_object_id().map(|o| o.to_hex()),
            message: Some("Duplicated.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  POST /{id}/send-now
// ---------------------------------------------------------------------------

pub async fn send_now(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<ProjectScopedBody>,
) -> Json<AckResult> {
    let (project_oid, bdoc) =
        match require_broadcast(&user, &s.mongo, &body.project_id, &broadcast_id).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };
    let status = normalise_status(bdoc.get_str("status").unwrap_or(ST_DRAFT));
    if status == ST_SENDING {
        return err("Broadcast is already sending.");
    }
    if status == ST_COMPLETED {
        return err("Broadcast already completed.");
    }
    if status == ST_CANCELLED {
        return err("Cancelled broadcasts cannot be sent.");
    }

    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };
    let bot_oid = match bdoc.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Broadcast is malformed."),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };

    let now = bson::DateTime::now();
    let coll = s.mongo.collection::<Document>(BROADCASTS);

    // 1. Flip status synchronously so the UI immediately reflects the
    //    transition.
    let _ = coll
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! { "$set": {
                "status": ST_SENDING,
                "startedAt": now,
                "updatedAt": now,
            } },
        )
        .await;

    // 2. Enqueue a pendingDispatch marker. A separate worker (out of
    //    scope here — see INTEGRATION NOTES) is expected to pop these.
    //    Until that worker lands we still do a synchronous fan-out
    //    below so the legacy text-only path keeps working.
    let pending = doc! {
        "broadcastId": bid,
        "projectId": project_oid,
        "botId": bot_oid,
        "userId": user_oid,
        "kind": "send_now",
        "createdAt": now,
        "status": "queued",
    };
    let _ = s
        .mongo
        .collection::<Document>(PENDING)
        .insert_one(pending)
        .await;
    tracing::info!(
        target = "telegram-broadcasts",
        broadcast_id = %broadcast_id,
        project_id = ?project_oid.to_hex(),
        "telegram.broadcast.dispatch_requested"
    );

    // 3. Synchronous fan-out (legacy fall-back). Sends a text-only
    //    message to every chat the audience targets. The worker will
    //    eventually take over media + keyboard + retry handling.
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => {
            return finalise_failed(&coll, bid, project_oid, "Bot not found.").await;
        }
        Err(e) => {
            return finalise_failed(&coll, bid, project_oid, &format!("mongo: {e}")).await;
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return finalise_failed(&coll, bid, project_oid, "Bot is missing its access token.")
                .await;
        }
    };

    let message = bdoc.get_document("message").cloned().unwrap_or_default();
    let text = message.get_str("text").unwrap_or("").to_owned();
    let parse_mode = message.get_str("parseMode").ok().map(str::to_owned);
    if text.is_empty() {
        return finalise_failed(
            &coll,
            bid,
            project_oid,
            "Only text broadcasts are supported in this slice — media support \
             will be enabled when the worker ships.",
        )
        .await;
    }

    let audience = bdoc.get_document("audience").cloned().unwrap_or_default();
    let chat_ids = match resolve_audience(&s.mongo, bot_oid, &audience).await {
        Ok(v) => v,
        Err(e) => return finalise_failed(&coll, bid, project_oid, &e).await,
    };
    let total = chat_ids.len() as i64;

    // Update counters.queued so the UI knows the planned fan-out size.
    let _ = coll
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! { "$set": {
                "counters.queued": total,
                "stats.total": total,
                "updatedAt": bson::DateTime::now(),
            } },
        )
        .await;

    let deliveries_coll = s.mongo.collection::<Document>(DELIVERIES);
    let mut sent = 0i64;
    let mut failed = 0i64;
    for chat_id in &chat_ids {
        let send_res = s
            .bot_api
            .send_message(
                &token,
                &SendMessageParams {
                    chat_id,
                    text: &text,
                    parse_mode: parse_mode.as_deref(),
                    reply_to_message_id: None,
                    business_connection_id: None,
                    disable_web_page_preview: None,
                },
            )
            .await;
        let mut row = doc! {
            "broadcastId": bid,
            "projectId": project_oid,
            "chatId": chat_id,
            "sentAt": bson::DateTime::now(),
        };
        match send_res {
            Ok(_) => {
                sent += 1;
                row.insert("status", "sent");
            }
            Err(e) => {
                failed += 1;
                row.insert("status", "failed");
                row.insert("errorMessage", e.to_string());
            }
        }
        let _ = deliveries_coll.insert_one(row).await;
    }

    let finished = bson::DateTime::now();
    let _ = coll
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! {
                "$set": {
                    "status": ST_COMPLETED,
                    "counters.sent": sent,
                    "counters.failed": failed,
                    "counters.queued": total,
                    "stats.sent": sent,
                    "stats.failed": failed,
                    "stats.total": total,
                    "completedAt": finished,
                    "updatedAt": finished,
                }
            },
        )
        .await;
    let _ = s
        .mongo
        .collection::<Document>(PENDING)
        .update_many(
            doc! { "broadcastId": bid, "status": "queued" },
            doc! { "$set": { "status": "consumed", "updatedAt": finished } },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some(format!("Sent to {sent} chats, {failed} failed.")),
        broadcast_id: Some(broadcast_id),
        ..Default::default()
    })
}

async fn finalise_failed(
    coll: &mongodb::Collection<Document>,
    bid: ObjectId,
    project_oid: ObjectId,
    msg: &str,
) -> Json<AckResult> {
    let now = bson::DateTime::now();
    let _ = coll
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! {
                "$set": {
                    "status": ST_FAILED,
                    "errorSummary": { "message": msg },
                    "completedAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await;
    err(msg.to_owned())
}

/// Resolve an audience descriptor into a flat list of chat ids.
async fn resolve_audience(
    mongo: &MongoHandle,
    bot_oid: ObjectId,
    audience: &Document,
) -> Result<Vec<String>, String> {
    let kind = audience.get_str("kind").unwrap_or("all");
    match kind {
        "contactIds" => {
            let ids = audience
                .get_array("ids")
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect();
            Ok(ids)
        }
        "channel" => {
            let chat_id = audience
                .get_str("channelChatId")
                .map_err(|_| "channelChatId is required for channel broadcasts.".to_owned())?;
            Ok(vec![chat_id.to_owned()])
        }
        "segment" => {
            // Segments map onto a saved filter. For this slice, we
            // require the filter to be embedded in the broadcast and
            // delegate to the `filter` kind below — the front-end is
            // expected to materialise segments before send.
            let inner = audience.get_document("filter").cloned().unwrap_or_default();
            collect_chats(mongo, bot_oid, &inner).await
        }
        "filter" => {
            let inner = audience.get_document("filter").cloned().unwrap_or_default();
            collect_chats(mongo, bot_oid, &inner).await
        }
        "tag" => {
            // Legacy: single tag pinned in the audience doc.
            let mut inner = Document::new();
            if let Ok(t) = audience.get_str("tag") {
                inner.insert("tag", t);
            }
            collect_chats(mongo, bot_oid, &inner).await
        }
        _ => collect_chats(mongo, bot_oid, &Document::new()).await,
    }
}

async fn collect_chats(
    mongo: &MongoHandle,
    bot_oid: ObjectId,
    filter: &Document,
) -> Result<Vec<String>, String> {
    let mut mongo_filter = doc! {
        "botId": bot_oid,
        "isOptedOut": { "$ne": true },
        "type": "private",
    };
    if let Ok(tag) = filter.get_str("tag") {
        mongo_filter.insert("tags", tag);
    }
    if let Ok(tags) = filter.get_array("tags") {
        mongo_filter.insert("tags", doc! { "$in": tags.clone() });
    }
    if let Ok(lang) = filter.get_str("lang") {
        mongo_filter.insert("languageCode", lang);
    }
    if let Ok(after) = filter.get_datetime("lastSeenAfter") {
        mongo_filter.insert("lastSeenAt", doc! { "$gte": after });
    }
    let cursor = mongo
        .collection::<Document>(CHATS)
        .find(mongo_filter)
        .limit(10_000)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    Ok(docs
        .iter()
        .filter_map(|d| d.get_str("chatId").ok().map(str::to_owned))
        .collect())
}

// ---------------------------------------------------------------------------
//  POST /{id}/schedule
// ---------------------------------------------------------------------------

pub async fn schedule(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<ScheduleBody>,
) -> Json<AckResult> {
    let (project_oid, bdoc) =
        match require_broadcast(&user, &s.mongo, &body.project_id, &broadcast_id).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };
    let status = normalise_status(bdoc.get_str("status").unwrap_or(ST_DRAFT));
    if status != ST_DRAFT && status != ST_SCHEDULED {
        return err("Only draft or scheduled broadcasts can be (re)scheduled.");
    }
    if body.scheduled_at <= Utc::now() {
        return err("scheduledAt must be in the future.");
    }
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };
    let now = bson::DateTime::now();
    match s
        .mongo
        .collection::<Document>(BROADCASTS)
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! { "$set": {
                "status": ST_SCHEDULED,
                "scheduledAt": bson::DateTime::from_chrono(body.scheduled_at),
                "updatedAt": now,
            } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Broadcast not found."),
        Ok(_) => Json(AckResult {
            success: true,
            broadcast_id: Some(broadcast_id),
            message: Some("Scheduled.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  POST /{id}/cancel
// ---------------------------------------------------------------------------

pub async fn cancel(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<ProjectScopedBody>,
) -> Json<AckResult> {
    let (project_oid, bdoc) =
        match require_broadcast(&user, &s.mongo, &body.project_id, &broadcast_id).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };
    let status = normalise_status(bdoc.get_str("status").unwrap_or(ST_DRAFT));
    if status != ST_SCHEDULED && status != ST_SENDING {
        return err("Only scheduled or sending broadcasts can be cancelled.");
    }
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };
    let now = bson::DateTime::now();
    let res = s
        .mongo
        .collection::<Document>(BROADCASTS)
        .update_one(
            doc! { "_id": bid, "projectId": project_oid },
            doc! { "$set": {
                "status": ST_CANCELLED,
                "completedAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    let _ = s
        .mongo
        .collection::<Document>(PENDING)
        .update_many(
            doc! { "broadcastId": bid, "status": "queued" },
            doc! { "$set": { "status": "cancelled", "updatedAt": now } },
        )
        .await;
    match res {
        Ok(_) => Json(AckResult {
            success: true,
            broadcast_id: Some(broadcast_id),
            message: Some("Cancelled.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  POST /{id}/test
// ---------------------------------------------------------------------------

pub async fn test_send(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<TestSendBody>,
) -> Json<AckResult> {
    let (_, bdoc) = match require_broadcast(&user, &s.mongo, &body.project_id, &broadcast_id).await
    {
        Ok(v) => v,
        Err(e) => return err(e),
    };
    let bot_oid = match bdoc.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Broadcast is malformed."),
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => return err("Bot not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t,
        Err(_) => return err("Bot is missing its access token."),
    };
    let message = bdoc.get_document("message").cloned().unwrap_or_default();
    let text = message.get_str("text").unwrap_or("").to_owned();
    if text.is_empty() {
        return err("Broadcast has no text content yet.");
    }
    let parse_mode = message.get_str("parseMode").ok().map(str::to_owned);
    let chat_id_str = body.chat_id.to_string();
    match s
        .bot_api
        .send_message(
            token,
            &SendMessageParams {
                chat_id: &chat_id_str,
                text: &text,
                parse_mode: parse_mode.as_deref(),
                reply_to_message_id: None,
                business_connection_id: None,
                disable_web_page_preview: None,
            },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            broadcast_id: Some(broadcast_id),
            message: Some("Test sent.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("send failed: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  GET /{id}/deliveries — paginated log
// ---------------------------------------------------------------------------

pub async fn deliveries(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<DeliveriesQuery>,
) -> Json<DeliveriesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let (project_oid, _) = match require_broadcast(&user, &s.mongo, project_id, &broadcast_id).await
    {
        Ok(v) => v,
        Err(e) => {
            return Json(DeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => {
            return Json(DeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some("Invalid broadcast id.".to_owned()),
            });
        }
    };

    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let mut filter = doc! { "broadcastId": bid, "projectId": project_oid };
    if let Some(status) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(cursor) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": cursor });
    }
    let cursor = match s
        .mongo
        .collection::<Document>(DELIVERIES)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(DeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(DeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let next_cursor = if docs.len() as i64 == limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok().map(|o| o.to_hex()))
    } else {
        None
    };
    let deliveries = docs.iter().filter_map(delivery_to_row).collect();
    Json(DeliveriesResp {
        deliveries,
        next_cursor,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  GET /{id}/deliveries.csv
// ---------------------------------------------------------------------------

pub async fn deliveries_csv(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return text_err(StatusCode::BAD_REQUEST, "projectId is required"),
    };
    let (project_oid, _) = match require_broadcast(&user, &s.mongo, project_id, &broadcast_id).await
    {
        Ok(v) => v,
        Err(e) => return text_err(StatusCode::NOT_FOUND, &e),
    };
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return text_err(StatusCode::BAD_REQUEST, "Invalid broadcast id."),
    };
    let cursor = match s
        .mongo
        .collection::<Document>(DELIVERIES)
        .find(doc! { "broadcastId": bid, "projectId": project_oid })
        .sort(doc! { "_id": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => return text_err(StatusCode::INTERNAL_SERVER_ERROR, &format!("mongo: {e}")),
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return text_err(StatusCode::INTERNAL_SERVER_ERROR, &format!("mongo: {e}")),
    };

    let mut out = String::new();
    out.push_str("chatId,status,errorCode,errorMessage,sentAt\n");
    for d in docs.iter().filter_map(delivery_to_row) {
        let line = format!(
            "{},{},{},{},{}\n",
            csv_cell(&d.chat_id),
            csv_cell(&d.status),
            d.error_code.map(|n| n.to_string()).unwrap_or_default(),
            csv_cell(d.error_message.as_deref().unwrap_or("")),
            d.sent_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        );
        out.push_str(&line);
    }

    let filename = format!("broadcast-{broadcast_id}-deliveries.csv");
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        "text/csv; charset=utf-8".parse().unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{filename}\"")
            .parse()
            .unwrap(),
    );
    (StatusCode::OK, headers, Body::from(out)).into_response()
}

fn csv_cell(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_owned()
    }
}

fn text_err(status: StatusCode, msg: &str) -> Response {
    (status, msg.to_owned()).into_response()
}

// ---------------------------------------------------------------------------
//  GET /analytics
// ---------------------------------------------------------------------------

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Query(q): Query<AnalyticsQuery>,
) -> Json<AnalyticsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AnalyticsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let from = q
        .from
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
    let to = q.to.unwrap_or_else(Utc::now);

    let filter = doc! {
        "projectId": project_oid,
        "createdAt": {
            "$gte": bson::DateTime::from_chrono(from),
            "$lte": bson::DateTime::from_chrono(to),
        },
    };
    let coll = s.mongo.collection::<Document>(BROADCASTS);
    let cursor = match coll.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let total_broadcasts = docs.len() as i64;
    let mut total_sent = 0i64;
    let mut total_failed = 0i64;
    let mut by_day_map: std::collections::BTreeMap<String, (i64, i64)> =
        std::collections::BTreeMap::new();

    for d in &docs {
        let counters_doc = d.get_document("counters").ok();
        let stats_doc = d.get_document("stats").ok();
        let sent = counters_doc
            .and_then(|c| c.get_i64("sent").ok())
            .or_else(|| stats_doc.and_then(|s| s.get_i64("sent").ok()))
            .unwrap_or(0);
        let failed = counters_doc
            .and_then(|c| c.get_i64("failed").ok())
            .or_else(|| stats_doc.and_then(|s| s.get_i64("failed").ok()))
            .unwrap_or(0);
        total_sent += sent;
        total_failed += failed;

        if let Some(created) = dt_opt(d.get_datetime("createdAt").ok().copied()) {
            let key = format!(
                "{:04}-{:02}-{:02}",
                created.year(),
                created.month(),
                created.day()
            );
            let entry = by_day_map.entry(key).or_insert((0, 0));
            entry.0 += sent;
            entry.1 += failed;
        }
    }

    let by_day = by_day_map
        .into_iter()
        .map(|(day, (sent, failed))| AnalyticsDayRow { day, sent, failed })
        .collect();

    let success_rate = if total_sent + total_failed > 0 {
        total_sent as f64 / (total_sent + total_failed) as f64
    } else {
        0.0
    };

    // Top failing error codes — aggregate over the deliveries side
    // table for this project in the same window.
    let mut top_errors = vec![];
    if let Ok(cur) = s
        .mongo
        .collection::<Document>(DELIVERIES)
        .find(doc! {
            "projectId": project_oid,
            "status": "failed",
            "sentAt": {
                "$gte": bson::DateTime::from_chrono(from),
                "$lte": bson::DateTime::from_chrono(to),
            },
        })
        .limit(5000)
        .await
    {
        if let Ok(rows) = cur.try_collect::<Vec<Document>>().await {
            let mut counts: std::collections::HashMap<String, i64> =
                std::collections::HashMap::new();
            for r in rows {
                let code = r
                    .get_i64("errorCode")
                    .map(|c| c.to_string())
                    .ok()
                    .or_else(|| r.get_str("errorMessage").ok().map(str::to_owned))
                    .unwrap_or_else(|| "unknown".to_owned());
                *counts.entry(code).or_insert(0) += 1;
            }
            let mut entries: Vec<(String, i64)> = counts.into_iter().collect();
            entries.sort_by(|a, b| b.1.cmp(&a.1));
            top_errors = entries
                .into_iter()
                .take(10)
                .map(|(code, count)| AnalyticsErrorRow { code, count })
                .collect();
        }
    }

    Json(AnalyticsResp {
        total_broadcasts,
        total_sent,
        total_failed,
        success_rate,
        top_errors,
        by_day,
        error: None,
    })
}
