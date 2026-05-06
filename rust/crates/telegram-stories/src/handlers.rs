use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::state::TelegramStoriesState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const POSTS: &str = "telegram_scheduled_posts";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "postId")]
    pub post_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PostRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub message: Value,
    pub status: String,
    #[serde(rename = "scheduledAt")]
    pub scheduled_at: DateTime<Utc>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub posts: Vec<PostRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub message: Value,
    #[serde(rename = "scheduledAt")]
    pub scheduled_at: DateTime<Utc>,
}

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
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
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

fn doc_to_row(d: &Document) -> Option<PostRow> {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    let v: Value = serde_json::from_value(raw).ok()?;
    let channel = if let Ok(o) = d.get_object_id("channelId") {
        o.to_hex()
    } else {
        d.get_str("channelId").ok()?.to_owned()
    };
    Some(PostRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        channel_id: channel,
        message: v.get("message").cloned().unwrap_or(Value::Null),
        status: d.get_str("status").unwrap_or("QUEUED").to_owned(),
        scheduled_at: dt(d.get_datetime("scheduledAt").ok().copied()),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                posts: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                posts: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                posts: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(POSTS)
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "scheduledAt": -1 })
        .limit(100)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                posts: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                posts: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let posts = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp { posts, error: None })
}

pub async fn schedule(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Json(body): Json<ScheduleBody>,
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
    let channel_oid = match parse_oid(&body.channel_id) {
        Some(o) => o,
        None => return err("Invalid channel id."),
    };

    let now = bson::DateTime::now();
    let message_doc = bson::to_document(&body.message).unwrap_or_default();
    let doc = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "userId": user_oid,
        "channelId": channel_oid,
        "message": message_doc,
        "status": "QUEUED",
        "scheduledAt": bson::DateTime::from_chrono(body.scheduled_at),
        "createdAt": now,
        "updatedAt": now,
    };
    match s.mongo.collection::<Document>(POSTS).insert_one(doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                post_id: Some(id),
                message: Some("Post scheduled.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn cancel(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(post_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<AckResult> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("botId is required"),
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    match s
        .mongo
        .collection::<Document>(POSTS)
        .update_one(
            doc! { "_id": oid, "botId": bot_oid },
            doc! { "$set": { "status": "CANCELLED", "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            post_id: Some(post_id),
            message: Some("Post cancelled.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}
