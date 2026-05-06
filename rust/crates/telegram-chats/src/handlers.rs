//! HTTP handlers for the Telegram Chats slice.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::{BotApiError, SendMessageParams};

use crate::dto::{
    AckResult, ChatRow, ListChatsQuery, ListChatsResp, ListMessagesQuery, ListMessagesResp,
    MessageRow, SendTextBody,
};
use crate::state::TelegramChatsState;

const PROJECTS_COLLECTION: &str = "projects";
const BOTS_COLLECTION: &str = "telegram_bots";
const CHATS_COLLECTION: &str = "telegram_chats";
const MESSAGES_COLLECTION: &str = "telegram_messages";

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

fn dt_or_now(opt: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    opt.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn dt_opt(opt: Option<bson::DateTime>) -> Option<chrono::DateTime<Utc>> {
    opt.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

fn doc_to_chat(d: &Document) -> Option<ChatRow> {
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
            .ok()?,
        direction: d.get_str("direction").unwrap_or("inbound").to_owned(),
        kind: d.get_str("type").unwrap_or("text").to_owned(),
        text: d.get_str("text").ok().map(str::to_owned),
        caption: d.get_str("caption").ok().map(str::to_owned),
        from_user_id: d.get_str("fromUserId").ok().map(str::to_owned),
        from_username: d.get_str("fromUsername").ok().map(str::to_owned),
        reply_to_message_id: d
            .get_i64("replyToMessageId")
            .or_else(|_| d.get_i32("replyToMessageId").map(i64::from))
            .ok(),
        status: d.get_str("status").unwrap_or("sent").to_owned(),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
    })
}

fn err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

// =========================================================================
//  GET /v1/telegram/chats?botId=…&q=…&limit=…  — listTelegramChats
// =========================================================================

pub async fn list_chats(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Query(q): Query<ListChatsQuery>,
) -> Json<ListChatsResp> {
    let bot_id_hex = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListChatsResp {
                chats: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id_hex).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListChatsResp {
                chats: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListChatsResp {
                chats: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };

    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let mut filter = doc! { "botId": bot_oid };
    if let Some(qs) = q.q.as_deref() {
        if !qs.is_empty() {
            let rx = doc! { "$regex": qs, "$options": "i" };
            filter.insert(
                "$or",
                bson::Bson::Array(vec![
                    bson::Bson::Document(doc! { "username": rx.clone() }),
                    bson::Bson::Document(doc! { "firstName": rx.clone() }),
                    bson::Bson::Document(doc! { "lastName": rx.clone() }),
                    bson::Bson::Document(doc! { "title": rx.clone() }),
                    bson::Bson::Document(doc! { "chatId": qs }),
                ]),
            );
        }
    }

    let coll = s.mongo.collection::<Document>(CHATS_COLLECTION);
    let cursor = match coll
        .find(filter)
        .sort(doc! { "lastMessageAt": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListChatsResp {
                chats: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };

    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListChatsResp {
                chats: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let chats = docs.iter().filter_map(doc_to_chat).collect();
    Json(ListChatsResp { chats, error: None })
}

// =========================================================================
//  GET /v1/telegram/chats/{bot_id}/{chat_id}/messages?limit=…
//  — listTelegramMessages
// =========================================================================

pub async fn list_messages(
    user: AuthUser,
    State(s): State<TelegramChatsState>,
    Path((bot_id, chat_id)): Path<(String, String)>,
    Query(q): Query<ListMessagesQuery>,
) -> Json<ListMessagesResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListMessagesResp {
                messages: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListMessagesResp {
                messages: vec![],
                error: Some("bot is malformed".to_owned()),
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
                messages: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };

    use futures::TryStreamExt;
    let mut docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListMessagesResp {
                messages: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    docs.reverse();
    let messages = docs.iter().filter_map(doc_to_message).collect();
    Json(ListMessagesResp {
        messages,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/chats/{bot_id}/{chat_id}/messages
//  — sendTelegramTextMessage
// =========================================================================

pub async fn send_text(
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

    let parse_mode_str = body.parse_mode.as_deref();
    let business_connection_str = body.business_connection_id.as_deref();
    let sent = match s
        .bot_api
        .send_message(
            &token,
            &SendMessageParams {
                chat_id: &chat_id,
                text,
                parse_mode: parse_mode_str,
                reply_to_message_id: body.reply_to_message_id,
                business_connection_id: business_connection_str,
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

// =========================================================================
//  POST /v1/telegram/chats/{bot_id}/{chat_id}/read
//  — markTelegramChatRead
// =========================================================================

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

    let chats = s.mongo.collection::<Document>(CHATS_COLLECTION);
    if let Err(e) = chats
        .update_one(
            doc! { "botId": bot_oid, "chatId": &chat_id },
            doc! { "$set": { "unreadCount": 0i64, "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        return err_ack(format!("mongo: {e}"));
    }

    Json(AckResult {
        success: true,
        message: Some("Marked read.".to_owned()),
        ..Default::default()
    })
}
