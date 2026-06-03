//! HTTP handlers for the Telegram Chats slice.

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    Json,
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use futures_util::Stream;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::{BotApiError, SendMessageParams};

use crate::dto::{
    AckResult, ChatActionBody, ChatMemberResp, ChatResp, ChatRow, CopyBody, EditMessageBody,
    ForwardBody, ListChatsQuery, ListChatsResp, ListMessagesQuery, ListMessagesResp, MessageRow,
    PinBody, ProjectBotQuery, SearchHit, SearchQuery, SearchResp, SendMessageBody, SendMessageResp,
    SendTextBody,
};
use crate::state::TelegramChatsState;

const PROJECTS_COLLECTION: &str = "projects";
const BOTS_COLLECTION: &str = "telegram_bots";
const CHATS_COLLECTION: &str = "telegram_chats";
const MESSAGES_COLLECTION: &str = "telegram_messages";
const SABFILES_NODES_COLLECTION: &str = "sabfiles_nodes";

// =========================================================================
//  Helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

fn err_ack(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

/// Verify the caller owns `project_id` (mirrors the telegram-ads
/// `require_project` pattern). Returns the project ObjectId.
async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS_COLLECTION)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

/// Resolve a bot id (hex string) and confirm the caller owns its
/// project. Returns the bot doc on success.
async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;

    let bots = mongo.collection::<Document>(BOTS_COLLECTION);
    let bot = bots
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;

    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let projects = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let project = projects
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    let owner = project.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

/// Like `require_bot` but also confirms the bot lives under `project_id`.
async fn require_bot_in_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
    project_id: &str,
) -> Result<Document, String> {
    let project_oid = require_project(user, mongo, project_id).await?;
    let bot = require_bot(user, mongo, bot_id_hex).await?;
    let bot_proj = bot
        .get_object_id("projectId")
        .map_err(|_| "bot missing projectId".to_owned())?;
    if bot_proj != project_oid {
        return Err("Bot does not belong to project.".to_owned());
    }
    Ok(bot)
}

fn dt_or_now(opt: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    opt.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn dt_opt(opt: Option<bson::DateTime>) -> Option<chrono::DateTime<Utc>> {
    opt.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

fn doc_to_chat(d: &Document) -> Option<ChatRow> {
    let permissions = d
        .get_document("permissions")
        .ok()
        .and_then(|p| bson::to_bson(p).ok())
        .and_then(|b| serde_json::to_value(b).ok());
    Some(ChatRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").ok()?.to_owned(),
        chat_type: d.get_str("type").unwrap_or("private").to_owned(),
        title: d.get_str("title").ok().map(str::to_owned),
        username: d.get_str("username").ok().map(str::to_owned),
        first_name: d.get_str("firstName").ok().map(str::to_owned),
        last_name: d.get_str("lastName").ok().map(str::to_owned),
        last_message_preview: d.get_str("lastMessagePreview").ok().map(str::to_owned),
        last_message_at: dt_opt(d.get_datetime("lastMessageAt").ok().copied()),
        unread_count: d
            .get_i64("unreadCount")
            .or_else(|_| d.get_i32("unreadCount").map(i64::from))
            .unwrap_or(0),
        is_opted_out: d.get_bool("isOptedOut").ok(),
        member_count: d
            .get_i64("memberCount")
            .or_else(|_| d.get_i32("memberCount").map(i64::from))
            .ok(),
        pinned_message_id: d
            .get_i64("pinnedMessageId")
            .or_else(|_| d.get_i32("pinnedMessageId").map(i64::from))
            .ok(),
        photo_url: d.get_str("photoUrl").ok().map(str::to_owned),
        permissions,
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt_or_now(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn doc_to_message(d: &Document) -> Option<MessageRow> {
    Some(MessageRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").ok()?.to_owned(),
        message_id: d
            .get_i64("messageId")
            .or_else(|_| d.get_i32("messageId").map(i64::from))
            .unwrap_or(0),
        direction: d.get_str("direction").unwrap_or("inbound").to_owned(),
        kind: d.get_str("type").unwrap_or("text").to_owned(),
        text: d.get_str("text").ok().map(str::to_owned),
        caption: d.get_str("caption").ok().map(str::to_owned),
        media_kind: d.get_str("mediaKind").ok().map(str::to_owned),
        media_file_id: d.get_str("mediaFileId").ok().map(str::to_owned),
        media_url: d.get_str("mediaUrl").ok().map(str::to_owned),
        sab_file_id: d.get_str("sabFileId").ok().map(str::to_owned),
        from_user_id: d.get_str("fromUserId").ok().map(str::to_owned),
        from_username: d.get_str("fromUsername").ok().map(str::to_owned),
        from_name: d.get_str("fromName").ok().map(str::to_owned),
        reply_to_message_id: d
            .get_i64("replyToMessageId")
            .or_else(|_| d.get_i32("replyToMessageId").map(i64::from))
            .ok(),
        reply_to_text: d.get_str("replyToText").ok().map(str::to_owned),
        status: d.get_str("status").unwrap_or("sent").to_owned(),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        is_deleted: d.get_bool("isDeleted").unwrap_or(false),
        edited_at: dt_opt(d.get_datetime("editedAt").ok().copied()),
        read_at: dt_opt(d.get_datetime("readAt").ok().copied()),
        sent_at: dt_opt(d.get_datetime("sentAt").ok().copied()),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
    })
}

fn err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

/// Resolve a SabFile by id → (url, name, mime). Pure Mongo lookup, no
/// dep on the sabfiles crate; we just read the same `sabfiles_nodes`
/// collection it owns.
async fn resolve_sabfile(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    sab_file_id: &str,
) -> Result<(String, String, String), String> {
    let node_oid = parse_oid(sab_file_id).ok_or_else(|| "invalid sabFileId".to_owned())?;
    let node = mongo
        .collection::<Document>(SABFILES_NODES_COLLECTION)
        .find_one(doc! { "_id": node_oid, "userId": user_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "SabFile not found.".to_owned())?;
    let name = node.get_str("name").unwrap_or("file").to_owned();
    let mime = node
        .get_str("mime")
        .unwrap_or("application/octet-stream")
        .to_owned();
    let r2_key = node
        .get_str("r2Key")
        .map_err(|_| "SabFile missing r2Key".to_owned())?
        .to_owned();
    // We prefer the public CDN URL when configured; otherwise we fall
    // back to the proxy endpoint. The Telegram API will fetch this URL,
    // so it must be publicly reachable. In dev `R2_PUBLIC_URL` is
    // commonly unset — callers should pass `sabFileUrl` directly.
    let base = std::env::var("R2_PUBLIC_URL").ok();
    let url = match base {
        Some(b) => format!("{}/{}", b.trim_end_matches('/'), r2_key),
        None => format!("/api/sabfiles/raw/{}", sab_file_id),
    };
    Ok((url, name, mime))
}

// =========================================================================
//  GET /v1/telegram/chats  — list chats with filters
// =========================================================================

pub async fn list_chats(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Query(q): Query<ListChatsQuery>,
) -> Json<ListChatsResp> {
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.or(q.limit).unwrap_or(50).clamp(1, 500);
    let skip = (page - 1) * page_size;

    // If projectId is provided, gate on it; otherwise fall back to the
    // bot-only listing the legacy callers still use.
    let mut filter = doc! {};
    if let Some(project_id) = q.project_id.as_deref() {
        if !project_id.is_empty() {
            let project_oid = match require_project(&user, &s.mongo, project_id).await {
                Ok(o) => o,
                Err(e) => {
                    return Json(ListChatsResp {
                        error: Some(e),
                        ..Default::default()
                    });
                }
            };
            filter.insert("projectId", project_oid);
        }
    }
    if let Some(bot_id_hex) = q.bot_id.as_deref() {
        if !bot_id_hex.is_empty() {
            let bot = match require_bot(&user, &s.mongo, bot_id_hex).await {
                Ok(b) => b,
                Err(e) => {
                    return Json(ListChatsResp {
                        error: Some(e),
                        ..Default::default()
                    });
                }
            };
            let bot_oid = match bot.get_object_id("_id") {
                Ok(o) => o,
                Err(_) => {
                    return Json(ListChatsResp {
                        error: Some("bot malformed".to_owned()),
                        ..Default::default()
                    });
                }
            };
            filter.insert("botId", bot_oid);
        }
    }
    if filter.is_empty() {
        return Json(ListChatsResp {
            error: Some("projectId or botId is required".to_owned()),
            ..Default::default()
        });
    }

    if let Some(t) = q.chat_type.as_deref() {
        if !t.is_empty() && t != "all" {
            filter.insert("type", t);
        }
    }

    if let Some(qs) = q.q.as_deref() {
        let qs = qs.trim();
        if !qs.is_empty() {
            let escaped = regex::escape(qs);
            let rx = doc! { "$regex": escaped, "$options": "i" };
            filter.insert(
                "$or",
                Bson::Array(vec![
                    Bson::Document(doc! { "username": rx.clone() }),
                    Bson::Document(doc! { "firstName": rx.clone() }),
                    Bson::Document(doc! { "lastName": rx.clone() }),
                    Bson::Document(doc! { "title": rx.clone() }),
                    Bson::Document(doc! { "chatId": qs }),
                ]),
            );
        }
    }

    let coll = s.mongo.collection::<Document>(CHATS_COLLECTION);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => {
            return Json(ListChatsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let cursor = match coll
        .find(filter)
        .sort(doc! { "lastMessageAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListChatsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListChatsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let chats: Vec<ChatRow> = docs.iter().filter_map(doc_to_chat).collect();
    let has_more = skip + (chats.len() as i64) < total;
    Json(ListChatsResp {
        chats,
        total,
        has_more,
        page,
        page_size,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/chats/{bot_id}/{chat_id}/messages   (legacy)
// =========================================================================

pub async fn list_messages_legacy(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((bot_id, chat_id)): Path<(String, String)>,
    Query(q): Query<ListMessagesQuery>,
) -> Json<ListMessagesResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListMessagesResp {
                error: Some("bot malformed".to_owned()),
                ..Default::default()
            });
        }
    };

    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let coll = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let cursor = match coll
        .find(doc! { "botId": bot_oid, "chatId": &chat_id })
        .sort(doc! { "messageId": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    use futures::TryStreamExt;
    let mut docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    docs.reverse();
    let messages = docs.iter().filter_map(doc_to_message).collect();
    Json(ListMessagesResp {
        messages,
        has_more: false,
        next_cursor: None,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/chats/{chat_doc_id}/messages — paginated history
// =========================================================================

pub async fn list_messages(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Query(q): Query<ListMessagesQuery>,
) -> Json<ListMessagesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListMessagesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => {
            return Json(ListMessagesResp {
                error: Some("invalid chat id".to_owned()),
                ..Default::default()
            });
        }
    };

    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(ListMessagesResp {
                error: Some("Chat not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let bot_oid = match chat.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListMessagesResp {
                error: Some("chat missing botId".to_owned()),
                ..Default::default()
            });
        }
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let coll = s.mongo.collection::<Document>(MESSAGES_COLLECTION);

    let mut filter = doc! { "botId": bot_oid, "chatId": &tg_chat_id };
    if let Some(cursor) = q.cursor.as_deref() {
        if let Some(oid) = parse_oid(cursor) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }

    // We fetch limit+1 to detect hasMore. Sort by _id desc (newest first
    // for cursor pagination) then reverse so the response is oldest-first.
    let cursor = match coll
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit + 1)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    use futures::TryStreamExt;
    let mut docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let has_more = (docs.len() as i64) > limit;
    if has_more {
        docs.truncate(limit as usize);
    }
    // docs are newest-first; cursor for next page is the oldest in this
    // batch (the last element in docs after truncate).
    let next_cursor = if has_more {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    } else {
        None
    };
    docs.reverse();
    let messages = docs.iter().filter_map(doc_to_message).collect();
    Json(ListMessagesResp {
        messages,
        has_more,
        next_cursor,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{chat_doc_id}/messages — send text or media
// =========================================================================

pub async fn send_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Json(body): Json<SendMessageBody>,
) -> Json<SendMessageResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SendMessageResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(SendMessageResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(SendMessageResp {
                success: false,
                error: Some("bot malformed".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(SendMessageResp {
                success: false,
                error: Some("Bot is missing its access token.".to_owned()),
                ..Default::default()
            });
        }
    };

    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => {
            return Json(SendMessageResp {
                success: false,
                error: Some("invalid chat id".to_owned()),
                ..Default::default()
            });
        }
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(SendMessageResp {
                success: false,
                error: Some("Chat not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(SendMessageResp {
                success: false,
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    if tg_chat_id.is_empty() {
        return Json(SendMessageResp {
            success: false,
            error: Some("Chat missing chatId".to_owned()),
            ..Default::default()
        });
    }

    let parse_mode = body.parse_mode.as_deref();
    let media_kind = body
        .media_kind
        .as_deref()
        .map(|m| m.trim().to_lowercase())
        .filter(|m| !m.is_empty());
    let text_trim = body.text.as_deref().map(str::trim).unwrap_or("");
    let caption_trim = body.caption.as_deref().map(str::trim).unwrap_or("");

    // Validate: must have text or media
    if media_kind.is_none() && text_trim.is_empty() {
        return Json(SendMessageResp {
            success: false,
            error: Some("text or media is required".to_owned()),
            ..Default::default()
        });
    }

    let now = bson::DateTime::now();
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => {
            return Json(SendMessageResp {
                success: false,
                error: Some("invalid auth subject".to_owned()),
                ..Default::default()
            });
        }
    };

    let (sent_value, persisted_kind, persisted_text, persisted_caption, media_url_for_log) =
        if let Some(kind) = media_kind {
            // Resolve SabFile bytes either from id or URL.
            let (bytes, mime, file_name, used_url) =
                match (body.sab_file_id.as_deref(), body.sab_file_url.as_deref()) {
                    (Some(id), _) if !id.is_empty() => {
                        let (url, name, mime_from_meta) =
                            match resolve_sabfile(&s.mongo, user_oid, id).await {
                                Ok(v) => v,
                                Err(e) => {
                                    return Json(SendMessageResp {
                                        success: false,
                                        error: Some(e),
                                        ..Default::default()
                                    });
                                }
                            };
                        let (b, mime, _n) = match s.bot_client.fetch_url(&url).await {
                            Ok(v) => v,
                            Err(e) => {
                                return Json(SendMessageResp {
                                    success: false,
                                    error: Some(e),
                                    ..Default::default()
                                });
                            }
                        };
                        let final_mime = if mime == "application/octet-stream" {
                            mime_from_meta
                        } else {
                            mime
                        };
                        (b, final_mime, name, url)
                    }
                    (_, Some(url)) if !url.is_empty() => {
                        let (b, mime, derived_name) = match s.bot_client.fetch_url(url).await {
                            Ok(v) => v,
                            Err(e) => {
                                return Json(SendMessageResp {
                                    success: false,
                                    error: Some(e),
                                    ..Default::default()
                                });
                            }
                        };
                        let final_name = body.sab_file_name.clone().unwrap_or(derived_name);
                        let final_mime = body.sab_file_mime.clone().unwrap_or(mime);
                        (b, final_mime, final_name, url.to_owned())
                    }
                    _ => {
                        return Json(SendMessageResp {
                            success: false,
                            error: Some("sabFileId or sabFileUrl is required for media".to_owned()),
                            ..Default::default()
                        });
                    }
                };

            let caption_opt = if caption_trim.is_empty() {
                None
            } else {
                Some(caption_trim)
            };
            let sent = match s
                .bot_client
                .send_media(
                    &token,
                    &kind,
                    &tg_chat_id,
                    &file_name,
                    &mime,
                    bytes,
                    caption_opt,
                    parse_mode,
                    body.reply_to_message_id,
                    body.disable_notification,
                )
                .await
            {
                Ok(v) => v,
                Err(e) => {
                    return Json(SendMessageResp {
                        success: false,
                        error: Some(e),
                        ..Default::default()
                    });
                }
            };
            (
                sent,
                kind,
                None,
                caption_opt.map(str::to_owned),
                Some(used_url),
            )
        } else {
            // Plain text send via shared bot_api.
            let sent = match s
                .bot_api
                .send_message(
                    &token,
                    &SendMessageParams {
                        chat_id: &tg_chat_id,
                        text: text_trim,
                        parse_mode,
                        reply_to_message_id: body.reply_to_message_id,
                        business_connection_id: None,
                        disable_web_page_preview: body.disable_web_page_preview,
                    },
                )
                .await
            {
                Ok(sm) => serde_json::json!({ "message_id": sm.message_id, "date": sm.date }),
                Err(e) => {
                    return Json(SendMessageResp {
                        success: false,
                        error: Some(err_msg(e)),
                        ..Default::default()
                    });
                }
            };
            (
                sent,
                "text".to_owned(),
                Some(text_trim.to_owned()),
                None,
                None,
            )
        };

    let message_id = sent_value
        .get("message_id")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // Pull media file_id from Telegram's response so we can later
    // re-send or reference it.
    let media_file_id = extract_media_file_id(&sent_value, &persisted_kind);

    let messages = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let mut msg_doc = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "chatId": &tg_chat_id,
        "messageId": message_id,
        "direction": "outbound",
        "type": persisted_kind.clone(),
        "status": "sent",
        "isDeleted": false,
        "sentAt": now,
        "createdAt": now,
    };
    if let Some(t) = &persisted_text {
        msg_doc.insert("text", t.as_str());
    }
    if let Some(c) = &persisted_caption {
        msg_doc.insert("caption", c.as_str());
    }
    if persisted_kind != "text" {
        msg_doc.insert("mediaKind", &persisted_kind);
    }
    if let Some(fid) = &media_file_id {
        msg_doc.insert("mediaFileId", fid.as_str());
    }
    if let Some(url) = &media_url_for_log {
        msg_doc.insert("mediaUrl", url.as_str());
    }
    if let Some(sab_id) = &body.sab_file_id {
        if !sab_id.is_empty() {
            msg_doc.insert("sabFileId", sab_id.as_str());
        }
    }
    if let Some(r) = body.reply_to_message_id {
        msg_doc.insert("replyToMessageId", r);
    }

    let insert_id = match messages.insert_one(msg_doc.clone()).await {
        Ok(ir) => ir.inserted_id.as_object_id(),
        Err(e) => {
            return Json(SendMessageResp {
                success: false,
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    if let Some(id) = insert_id {
        msg_doc.insert("_id", id);
    }

    let preview: String = persisted_text
        .as_deref()
        .or(persisted_caption.as_deref())
        .map(|s| s.chars().take(120).collect())
        .unwrap_or_else(|| {
            if persisted_kind == "text" {
                String::new()
            } else {
                format!("[{}]", persisted_kind)
            }
        });
    let chats = s.mongo.collection::<Document>(CHATS_COLLECTION);
    let _ = chats
        .update_one(
            doc! { "_id": chat_oid },
            doc! {
                "$set": {
                    "lastMessageId": message_id,
                    "lastMessageAt": now,
                    "lastMessagePreview": preview,
                    "updatedAt": now,
                },
            },
        )
        .await;

    let row = doc_to_message(&msg_doc);
    Json(SendMessageResp {
        success: true,
        error: None,
        message_id: Some(message_id),
        row,
    })
}

fn extract_media_file_id(sent: &serde_json::Value, kind: &str) -> Option<String> {
    match kind {
        "photo" => sent
            .get("photo")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.last())
            .and_then(|p| p.get("file_id"))
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        "video" => sent
            .get("video")
            .and_then(|v| v.get("file_id"))
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        "document" => sent
            .get("document")
            .and_then(|v| v.get("file_id"))
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        "audio" => sent
            .get("audio")
            .and_then(|v| v.get("file_id"))
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        "voice" => sent
            .get("voice")
            .and_then(|v| v.get("file_id"))
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        _ => None,
    }
}

// =========================================================================
//  PATCH /v1/telegram/chats/{chat_doc_id}/messages/{message_id}
// =========================================================================

pub async fn edit_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Json(body): Json<EditMessageBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();

    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("bot malformed"),
    };
    let messages = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let existing = match messages
        .find_one(doc! { "botId": bot_oid, "chatId": &tg_chat_id, "messageId": message_id })
        .await
    {
        Ok(Some(m)) => m,
        Ok(None) => return err_ack("Message not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let kind = existing.get_str("type").unwrap_or("text");
    let parse_mode = body.parse_mode.as_deref();

    let mut set = doc! { "editedAt": bson::DateTime::now(), "updatedAt": bson::DateTime::now() };
    if kind == "text" {
        let text = match body.text.as_deref().map(str::trim) {
            Some(t) if !t.is_empty() => t,
            _ => return err_ack("text is required"),
        };
        if let Err(e) = s
            .bot_client
            .edit_message_text(&token, &tg_chat_id, message_id, text, parse_mode)
            .await
        {
            return err_ack(e);
        }
        set.insert("text", text);
    } else {
        let caption = match body.caption.as_deref().map(str::trim) {
            Some(c) if !c.is_empty() => c,
            _ => return err_ack("caption is required"),
        };
        if let Err(e) = s
            .bot_client
            .edit_message_caption(&token, &tg_chat_id, message_id, caption, parse_mode)
            .await
        {
            return err_ack(e);
        }
        set.insert("caption", caption);
    }
    let _ = messages
        .update_one(
            doc! { "botId": bot_oid, "chatId": &tg_chat_id, "messageId": message_id },
            doc! { "$set": set },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Edited.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// =========================================================================
//  DELETE /v1/telegram/chats/{chat_doc_id}/messages/{message_id}
// =========================================================================

pub async fn delete_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(b) if !b.is_empty() => b,
        _ => return err_ack("botId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("bot malformed"),
    };

    if let Err(e) = s
        .bot_client
        .delete_message(&token, &tg_chat_id, message_id)
        .await
    {
        return err_ack(e);
    }
    let _ = s
        .mongo
        .collection::<Document>(MESSAGES_COLLECTION)
        .update_one(
            doc! { "botId": bot_oid, "chatId": &tg_chat_id, "messageId": message_id },
            doc! {
                "$set": {
                    "isDeleted": true,
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Deleted.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{chat_doc_id}/messages/{message_id}/forward
// =========================================================================

pub async fn forward_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Json(body): Json<ForwardBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    if let Err(e) = s
        .bot_client
        .forward_message(
            &token,
            &tg_chat_id,
            &body.to_chat_id,
            message_id,
            body.disable_notification,
        )
        .await
    {
        return err_ack(e);
    }
    Json(AckResult {
        success: true,
        message: Some("Forwarded.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{chat_doc_id}/messages/{message_id}/copy
// =========================================================================

pub async fn copy_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Json(body): Json<CopyBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    if let Err(e) = s
        .bot_client
        .copy_message(
            &token,
            &tg_chat_id,
            &body.to_chat_id,
            message_id,
            body.caption.as_deref(),
            body.parse_mode.as_deref(),
        )
        .await
    {
        return err_ack(e);
    }
    Json(AckResult {
        success: true,
        message: Some("Copied.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{chat_doc_id}/messages/{message_id}/pin
//  DELETE …/pin — unpin
// =========================================================================

pub async fn pin_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Json(body): Json<PinBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();

    if let Err(e) = s
        .bot_client
        .pin_chat_message(&token, &tg_chat_id, message_id, body.disable_notification)
        .await
    {
        return err_ack(e);
    }
    let _ = s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .update_one(
            doc! { "_id": chat_oid },
            doc! {
                "$set": {
                    "pinnedMessageId": message_id,
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Pinned.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

pub async fn unpin_message(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, message_id)): Path<(String, i64)>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(b) if !b.is_empty() => b,
        _ => return err_ack("botId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    if let Err(e) = s
        .bot_client
        .unpin_chat_message(&token, &tg_chat_id, Some(message_id))
        .await
    {
        return err_ack(e);
    }
    let _ = s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .update_one(
            doc! { "_id": chat_oid },
            doc! {
                "$unset": { "pinnedMessageId": "" },
                "$set": { "updatedAt": bson::DateTime::now() }
            },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Unpinned.".to_owned()),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{chat_doc_id}/action — sendChatAction
// =========================================================================

pub async fn chat_action(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Json(body): Json<ChatActionBody>,
) -> Json<AckResult> {
    let action = body.action.trim();
    let allowed = matches!(
        action,
        "typing"
            | "upload_photo"
            | "record_video"
            | "upload_video"
            | "record_voice"
            | "upload_voice"
            | "upload_document"
            | "choose_sticker"
            | "find_location"
            | "record_video_note"
            | "upload_video_note"
    );
    if !allowed {
        return err_ack("unsupported action");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&user, &s.mongo, &body.bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot missing token."),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return err_ack("invalid chat id"),
    };
    let chat = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return err_ack("Chat not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let tg_chat_id = chat.get_str("chatId").unwrap_or("").to_owned();
    if let Err(e) = s
        .bot_client
        .send_chat_action(&token, &tg_chat_id, action)
        .await
    {
        return err_ack(e);
    }
    Json(AckResult {
        success: true,
        message: Some("ok".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  GET /v1/telegram/chats/{chat_doc_id} — chat metadata (cached)
//  POST /v1/telegram/chats/{chat_doc_id}/refresh — force re-fetch
// =========================================================================

async fn refresh_chat_metadata(
    s: &TelegramChatsState,
    token: &str,
    chat_oid: ObjectId,
    tg_chat_id: &str,
) -> Result<ChatRow, String> {
    let info = s.bot_client.get_chat(token, tg_chat_id).await?;
    let member_count = if matches!(
        info.get("type").and_then(|v| v.as_str()).unwrap_or(""),
        "group" | "supergroup" | "channel"
    ) {
        s.bot_client
            .get_chat_member_count(token, tg_chat_id)
            .await
            .ok()
    } else {
        None
    };

    let mut set = doc! { "updatedAt": bson::DateTime::now() };
    if let Some(t) = info.get("title").and_then(|v| v.as_str()) {
        set.insert("title", t);
    }
    if let Some(u) = info.get("username").and_then(|v| v.as_str()) {
        set.insert("username", u);
    }
    if let Some(f) = info.get("first_name").and_then(|v| v.as_str()) {
        set.insert("firstName", f);
    }
    if let Some(l) = info.get("last_name").and_then(|v| v.as_str()) {
        set.insert("lastName", l);
    }
    if let Some(t) = info.get("type").and_then(|v| v.as_str()) {
        set.insert("type", t);
    }
    if let Some(pm) = info.get("pinned_message") {
        if let Some(mid) = pm.get("message_id").and_then(|v| v.as_i64()) {
            set.insert("pinnedMessageId", mid);
        }
    }
    if let Some(mc) = member_count {
        set.insert("memberCount", mc);
    }
    if let Some(perms) = info.get("permissions") {
        if let Ok(b) = bson::to_bson(perms) {
            set.insert("permissions", b);
        }
    }

    let coll = s.mongo.collection::<Document>(CHATS_COLLECTION);
    coll.update_one(doc! { "_id": chat_oid }, doc! { "$set": set })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let updated = coll
        .find_one(doc! { "_id": chat_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "chat vanished".to_owned())?;
    doc_to_chat(&updated).ok_or_else(|| "chat malformed".to_owned())
}

pub async fn get_chat(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<ChatResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ChatResp {
                error: Some("projectId is required".to_owned()),
                chat: None,
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ChatResp {
                error: Some(e),
                chat: None,
            });
        }
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => {
            return Json(ChatResp {
                error: Some("invalid chat id".to_owned()),
                chat: None,
            });
        }
    };
    let chat_doc = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(ChatResp {
                error: Some("Chat not found.".to_owned()),
                chat: None,
            });
        }
        Err(e) => {
            return Json(ChatResp {
                error: Some(format!("mongo: {e}")),
                chat: None,
            });
        }
    };

    // Best-effort refresh when botId is provided. Errors are swallowed
    // and we fall back to the cached doc — the user might be opening a
    // chat while the bot is temporarily unreachable.
    if let Some(bot_id) = q.bot_id.as_deref() {
        if !bot_id.is_empty() {
            if let Ok(bot) = require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
                if let Ok(token) = bot.get_str("token") {
                    let tg_chat_id = chat_doc.get_str("chatId").unwrap_or("").to_owned();
                    if let Ok(row) = refresh_chat_metadata(&s, token, chat_oid, &tg_chat_id).await {
                        return Json(ChatResp {
                            chat: Some(row),
                            error: None,
                        });
                    }
                }
            }
        }
    }
    Json(ChatResp {
        chat: doc_to_chat(&chat_doc),
        error: None,
    })
}

pub async fn refresh_chat(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Json(body): Json<ProjectBotQuery>,
) -> Json<ChatResp> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ChatResp {
                error: Some("projectId is required".to_owned()),
                chat: None,
            });
        }
    };
    let bot_id = match body.bot_id.as_deref() {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Json(ChatResp {
                error: Some("botId is required".to_owned()),
                chat: None,
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ChatResp {
                error: Some(e),
                chat: None,
            });
        }
    };
    let bot = match require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ChatResp {
                error: Some(e),
                chat: None,
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(ChatResp {
                error: Some("Bot missing token.".to_owned()),
                chat: None,
            });
        }
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => {
            return Json(ChatResp {
                error: Some("invalid chat id".to_owned()),
                chat: None,
            });
        }
    };
    let chat_doc = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(ChatResp {
                error: Some("Chat not found.".to_owned()),
                chat: None,
            });
        }
        Err(e) => {
            return Json(ChatResp {
                error: Some(format!("mongo: {e}")),
                chat: None,
            });
        }
    };
    let tg_chat_id = chat_doc.get_str("chatId").unwrap_or("").to_owned();
    match refresh_chat_metadata(&s, &token, chat_oid, &tg_chat_id).await {
        Ok(row) => Json(ChatResp {
            chat: Some(row),
            error: None,
        }),
        Err(e) => Json(ChatResp {
            error: Some(e),
            chat: None,
        }),
    }
}

// =========================================================================
//  GET /v1/telegram/chats/{chat_doc_id}/member/{user_id} — getChatMember
// =========================================================================

pub async fn get_chat_member(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((chat_doc_id, member_user_id)): Path<(String, i64)>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<ChatMemberResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ChatMemberResp {
                error: Some("projectId is required".to_owned()),
                member: None,
            });
        }
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Json(ChatMemberResp {
                error: Some("botId is required".to_owned()),
                member: None,
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ChatMemberResp {
                error: Some(e),
                member: None,
            });
        }
    };
    let bot = match require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ChatMemberResp {
                error: Some(e),
                member: None,
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(ChatMemberResp {
                error: Some("Bot missing token.".to_owned()),
                member: None,
            });
        }
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => {
            return Json(ChatMemberResp {
                error: Some("invalid chat id".to_owned()),
                member: None,
            });
        }
    };
    let chat_doc = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(ChatMemberResp {
                error: Some("Chat not found.".to_owned()),
                member: None,
            });
        }
        Err(e) => {
            return Json(ChatMemberResp {
                error: Some(format!("mongo: {e}")),
                member: None,
            });
        }
    };
    let tg_chat_id = chat_doc.get_str("chatId").unwrap_or("").to_owned();
    match s
        .bot_client
        .get_chat_member(&token, &tg_chat_id, member_user_id)
        .await
    {
        Ok(member) => Json(ChatMemberResp {
            member: Some(member),
            error: None,
        }),
        Err(e) => Json(ChatMemberResp {
            error: Some(e),
            member: None,
        }),
    }
}

// =========================================================================
//  GET /v1/telegram/chats/search — full-text search across messages
// =========================================================================

pub async fn search_messages(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Query(q): Query<SearchQuery>,
) -> Json<SearchResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SearchResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SearchResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let query_str = match q.q.as_deref().map(str::trim) {
        Some(s) if !s.is_empty() => s.to_owned(),
        _ => {
            return Json(SearchResp {
                error: Some("q is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let mut filter = doc! { "projectId": project_oid };

    if let Some(bot_id) = q.bot_id.as_deref() {
        if !bot_id.is_empty() {
            let bot = match require_bot_in_project(&user, &s.mongo, bot_id, project_id).await {
                Ok(b) => b,
                Err(e) => {
                    return Json(SearchResp {
                        error: Some(e),
                        ..Default::default()
                    });
                }
            };
            if let Ok(o) = bot.get_object_id("_id") {
                filter.insert("botId", o);
            }
        }
    }
    if let Some(chat_id) = q.chat_id.as_deref() {
        if !chat_id.is_empty() {
            filter.insert("chatId", chat_id);
        }
    }

    let escaped = regex::escape(&query_str);
    let rx = doc! { "$regex": escaped, "$options": "i" };
    filter.insert(
        "$or",
        Bson::Array(vec![
            Bson::Document(doc! { "text": rx.clone() }),
            Bson::Document(doc! { "caption": rx.clone() }),
        ]),
    );

    // Date range on createdAt
    let mut range = doc! {};
    if let Some(from) = q.from.as_deref() {
        if let Ok(d) = chrono::DateTime::parse_from_rfc3339(from) {
            range.insert(
                "$gte",
                bson::DateTime::from_millis(d.with_timezone(&Utc).timestamp_millis()),
            );
        }
    }
    if let Some(to) = q.to.as_deref() {
        if let Ok(d) = chrono::DateTime::parse_from_rfc3339(to) {
            range.insert(
                "$lte",
                bson::DateTime::from_millis(d.with_timezone(&Utc).timestamp_millis()),
            );
        }
    }
    if !range.is_empty() {
        filter.insert("createdAt", range);
    }
    if let Some(cursor) = q.cursor.as_deref() {
        if let Some(oid) = parse_oid(cursor) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 200);

    let coll = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let cursor = match coll
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit + 1)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(SearchResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    use futures::TryStreamExt;
    let mut docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(SearchResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let has_more = (docs.len() as i64) > limit;
    if has_more {
        docs.truncate(limit as usize);
    }
    let next_cursor = if has_more {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    } else {
        None
    };

    // Augment with chat metadata. One lookup per unique (botId, chatId).
    let chats_coll = s.mongo.collection::<Document>(CHATS_COLLECTION);
    let mut messages = Vec::with_capacity(docs.len());
    for d in &docs {
        let row = match doc_to_message(d) {
            Some(r) => r,
            None => continue,
        };
        let bot_oid = d.get_object_id("botId").ok();
        let chat_id = d.get_str("chatId").unwrap_or("").to_owned();
        let chat_doc = if let Some(b) = bot_oid {
            chats_coll
                .find_one(doc! { "botId": b, "chatId": &chat_id })
                .await
                .ok()
                .flatten()
        } else {
            None
        };
        let chat_title = chat_doc
            .as_ref()
            .and_then(|c| c.get_str("title").ok().map(str::to_owned))
            .or_else(|| {
                chat_doc.as_ref().and_then(|c| {
                    let fn_ = c.get_str("firstName").unwrap_or("");
                    let ln = c.get_str("lastName").unwrap_or("");
                    let joined = format!("{fn_} {ln}").trim().to_owned();
                    if joined.is_empty() {
                        None
                    } else {
                        Some(joined)
                    }
                })
            });
        let chat_type = chat_doc
            .as_ref()
            .and_then(|c| c.get_str("type").ok().map(str::to_owned));
        messages.push(SearchHit {
            message: row,
            chat_title,
            chat_type,
        });
    }

    Json(SearchResp {
        messages,
        has_more,
        next_cursor,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/chats/{chat_doc_id}/stream — SSE live messages
// =========================================================================

pub async fn message_stream(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path(chat_doc_id): Path<String>,
    Query(q): Query<ProjectBotQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, Json<AckResult>> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p.to_owned(),
        _ => return Err(err_ack("projectId is required")),
    };
    let project_oid = match require_project(&user, &s.mongo, &project_id).await {
        Ok(o) => o,
        Err(e) => return Err(err_ack(e)),
    };
    let chat_oid = match parse_oid(&chat_doc_id) {
        Some(o) => o,
        None => return Err(err_ack("invalid chat id")),
    };
    let chat_doc = match s
        .mongo
        .collection::<Document>(CHATS_COLLECTION)
        .find_one(doc! { "_id": chat_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => return Err(err_ack("Chat not found.")),
        Err(e) => return Err(err_ack(format!("mongo: {e}"))),
    };
    let bot_oid = match chat_doc.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return Err(err_ack("chat missing botId")),
    };
    let tg_chat_id = chat_doc.get_str("chatId").unwrap_or("").to_owned();

    let messages = s.mongo.collection::<Document>(MESSAGES_COLLECTION);

    // Seed cursor at "now": only stream rows inserted AFTER stream open.
    let mut last_id: ObjectId = ObjectId::new();

    let stream = async_stream::stream! {
        // First yield a hello so clients can detect handshake.
        yield Ok::<_, Infallible>(Event::default().event("hello").data("ok"));

        let poll_interval = Duration::from_millis(1500);
        let idle_timeout = Duration::from_secs(300);
        let mut idle_since = std::time::Instant::now();
        loop {
            tokio::time::sleep(poll_interval).await;

            let filter = doc! {
                "botId": bot_oid,
                "chatId": &tg_chat_id,
                "_id": { "$gt": last_id },
            };
            let cursor = match messages
                .find(filter)
                .sort(doc! { "_id": 1 })
                .limit(50)
                .await
            {
                Ok(c) => c,
                Err(_) => continue,
            };
            use futures::TryStreamExt;
            let docs: Vec<Document> = match cursor.try_collect().await {
                Ok(v) => v,
                Err(_) => continue,
            };
            if docs.is_empty() {
                if idle_since.elapsed() >= idle_timeout {
                    break;
                }
                continue;
            }
            idle_since = std::time::Instant::now();
            for d in &docs {
                if let Ok(oid) = d.get_object_id("_id") {
                    if oid > last_id {
                        last_id = oid;
                    }
                }
                if let Some(row) = doc_to_message(d) {
                    if let Ok(payload) = serde_json::to_string(&row) {
                        yield Ok(Event::default().event("message").data(payload));
                    }
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

// =========================================================================
//  Legacy: text send + mark read on /{bot_id}/{chat_id}/...
// =========================================================================

pub async fn send_text_legacy(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((bot_id, chat_id)): Path<(String, String)>,
    Json(body): Json<SendTextBody>,
) -> Json<AckResult> {
    let text = body.text.trim();
    if text.is_empty() {
        return err_ack("Message text is required.");
    }

    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err_ack("Bot is missing its access token."),
    };
    let project_oid = match bot.get_object_id("projectId") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot is missing projectId."),
    };

    let sent = match s
        .bot_api
        .send_message(
            &token,
            &SendMessageParams {
                chat_id: &chat_id,
                text,
                parse_mode: body.parse_mode.as_deref(),
                reply_to_message_id: body.reply_to_message_id,
                business_connection_id: body.business_connection_id.as_deref(),
                disable_web_page_preview: None,
            },
        )
        .await
    {
        Ok(s) => s,
        Err(e) => return err_ack(err_msg(e)),
    };

    let now = bson::DateTime::now();
    let messages = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let mut msg_doc = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "chatId": &chat_id,
        "messageId": sent.message_id,
        "direction": "outbound",
        "type": "text",
        "text": text,
        "status": "sent",
        "isDeleted": false,
        "sentAt": now,
        "createdAt": now,
    };
    if let Some(r) = body.reply_to_message_id {
        msg_doc.insert("replyToMessageId", r);
    }
    if let Some(b) = &body.business_connection_id {
        msg_doc.insert("businessConnectionId", b.as_str());
    }
    if let Err(e) = messages.insert_one(msg_doc).await {
        return err_ack(format!("mongo: {e}"));
    }

    let chats = s.mongo.collection::<Document>(CHATS_COLLECTION);
    let preview: String = text.chars().take(120).collect();
    let _ = chats
        .update_one(
            doc! { "botId": bot_oid, "chatId": &chat_id },
            doc! {
                "$set": {
                    "lastMessageId": sent.message_id,
                    "lastMessageAt": now,
                    "lastMessagePreview": preview,
                    "updatedAt": now,
                },
            },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Message sent.".to_owned()),
        message_id: Some(sent.message_id),
        ..Default::default()
    })
}

pub async fn mark_read(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((bot_id, chat_id)): Path<(String, String)>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot not found."),
    };

    let now = bson::DateTime::now();
    let chats = s.mongo.collection::<Document>(CHATS_COLLECTION);
    if let Err(e) = chats
        .update_one(
            doc! { "botId": bot_oid, "chatId": &chat_id },
            doc! { "$set": { "unreadCount": 0i64, "updatedAt": now } },
        )
        .await
    {
        return err_ack(format!("mongo: {e}"));
    }
    // Best-effort: stamp readAt on inbound messages that don't yet have
    // one. This is the field the chat-list "unread" badge falls back on
    // when `unreadCount` isn't authoritative.
    let messages = s.mongo.collection::<Document>(MESSAGES_COLLECTION);
    let _ = messages
        .update_many(
            doc! {
                "botId": bot_oid,
                "chatId": &chat_id,
                "direction": "inbound",
                "readAt": { "$exists": false }
            },
            doc! { "$set": { "readAt": now } },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Marked read.".to_owned()),
        ..Default::default()
    })
}
