use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramChannelsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHANNELS: &str = "telegram_channels";

#[derive(Debug, Clone, Serialize)]
pub struct ChannelRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(rename = "memberCount")]
    pub member_count: i64,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub channels: Vec<ChannelRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn dt_or_now(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
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

fn doc_to_row(d: &Document) -> Option<ChannelRow> {
    Some(ChannelRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").ok()?.to_owned(),
        title: d.get_str("title").ok().map(str::to_owned),
        username: d.get_str("username").ok().map(str::to_owned),
        member_count: d
            .get_i64("memberCount")
            .or_else(|_| d.get_i32("memberCount").map(i64::from))
            .unwrap_or(0),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
    })
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                channels: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                channels: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(CHANNELS)
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let channels = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp {
        channels,
        error: None,
    })
}
