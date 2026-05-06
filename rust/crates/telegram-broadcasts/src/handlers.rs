use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::SendMessageParams;

use crate::dto::{AckResult, BroadcastRow, CreateBody, ListQuery, ListResp};
use crate::state::TelegramBroadcastsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHATS: &str = "telegram_chats";
const BROADCASTS: &str = "telegram_broadcasts";

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

fn doc_to_row(d: &Document) -> Option<BroadcastRow> {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    let v: serde_json::Value = serde_json::from_value(raw).ok()?;
    Some(BroadcastRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("DRAFT").to_owned(),
        audience: v.get("audience").cloned().unwrap_or(serde_json::Value::Null),
        message: v.get("message").cloned().unwrap_or(serde_json::Value::Null),
        stats: v.get("stats").cloned().unwrap_or(serde_json::Value::Null),
        scheduled_at: dt_opt(d.get_datetime("scheduledAt").ok().copied()),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt_or_now(d.get_datetime("updatedAt").ok().copied()),
    })
}

// =========================================================================
//  GET /v1/telegram/broadcasts?botId=… — listTelegramBroadcasts
// =========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                broadcasts: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                broadcasts: vec![],
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
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                broadcasts: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let broadcasts = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp {
        broadcasts,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/broadcasts — createTelegramBroadcast
// =========================================================================

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let project_oid = match bot.get_object_id("projectId") {
        Ok(o) => o,
        Err(_) => return err("Bot is missing projectId."),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };

    let now = bson::DateTime::now();
    let status = if body.scheduled_at.is_some() {
        "QUEUED"
    } else {
        "DRAFT"
    };
    let audience_doc = bson::to_document(&body.audience).unwrap_or_default();
    let message_doc = bson::to_document(&body.message).unwrap_or_default();

    let mut d = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "userId": user_oid,
        "name": body.name,
        "audience": audience_doc,
        "message": message_doc,
        "status": status,
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

// =========================================================================
//  POST /v1/telegram/broadcasts/{id}/send — sendTelegramBroadcastNow
// =========================================================================

pub async fn send_now(
    user: AuthUser,
    State(s): State<TelegramBroadcastsState>,
    Path(broadcast_id): Path<String>,
) -> Json<AckResult> {
    let bid = match parse_oid(&broadcast_id) {
        Some(o) => o,
        None => return err("Invalid broadcast id."),
    };
    let coll = s.mongo.collection::<Document>(BROADCASTS);
    let bdoc = match coll.find_one(doc! { "_id": bid }).await {
        Ok(Some(d)) => d,
        Ok(None) => return err("Broadcast not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };

    let bot_oid = match bdoc.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Broadcast is malformed."),
    };
    let bot = match require_bot(&user, &s.mongo, &bot_oid.to_hex()).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    let message = match bdoc.get_document("message") {
        Ok(d) => d,
        Err(_) => return err("Broadcast message is missing."),
    };
    let text = message.get_str("text").unwrap_or("").to_owned();
    if text.is_empty() {
        return err("Only text broadcasts are supported in this slice.");
    }

    let audience = bdoc.get_document("audience").cloned().unwrap_or_default();
    let kind = audience.get_str("kind").unwrap_or("all").to_owned();

    // Build chat list. For a single-channel broadcast, send to one
    // chatId. Otherwise list private chats for the bot, optionally
    // filtered by tag.
    let chat_ids: Vec<String> = if kind == "channel" {
        match audience.get_str("channelChatId").ok() {
            Some(c) => vec![c.to_owned()],
            None => {
                return err("channelChatId is required for channel broadcasts.");
            }
        }
    } else {
        let mut filter = doc! {
            "botId": bot_oid,
            "isOptedOut": { "$ne": true },
            "type": "private",
        };
        if kind == "tag" {
            if let Ok(tag) = audience.get_str("tag") {
                filter.insert("tags", tag);
            }
        }
        let chats_coll = s.mongo.collection::<Document>(CHATS);
        let cursor = match chats_coll.find(filter).limit(10_000).await {
            Ok(c) => c,
            Err(e) => return err(format!("mongo: {e}")),
        };
        use futures::TryStreamExt;
        let docs: Vec<Document> = match cursor.try_collect().await {
            Ok(v) => v,
            Err(e) => return err(format!("mongo: {e}")),
        };
        docs.iter()
            .filter_map(|d| d.get_str("chatId").ok().map(str::to_owned))
            .collect()
    };

    let total = chat_ids.len() as i64;
    let _ = coll
        .update_one(
            doc! { "_id": bid },
            doc! { "$set": { "status": "SENDING", "stats.total": total, "updatedAt": bson::DateTime::now() } },
        )
        .await;

    let mut sent = 0i64;
    let mut failed = 0i64;
    for chat_id in &chat_ids {
        match s
            .bot_api
            .send_message(
                &token,
                &SendMessageParams {
                    chat_id,
                    text: &text,
                    parse_mode: None,
                    reply_to_message_id: None,
                    business_connection_id: None,
                    disable_web_page_preview: None,
                },
            )
            .await
        {
            Ok(_) => sent += 1,
            Err(_) => failed += 1,
        }
    }

    let _ = coll
        .update_one(
            doc! { "_id": bid },
            doc! {
                "$set": {
                    "status": "SENT",
                    "stats.sent": sent,
                    "stats.failed": failed,
                    "stats.total": total,
                    "sentAt": bson::DateTime::now(),
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some(format!("Sent to {sent} chats, {failed} failed.")),
        broadcast_id: Some(broadcast_id),
        ..Default::default()
    })
}
