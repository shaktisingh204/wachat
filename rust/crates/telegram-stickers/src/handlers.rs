use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramStickersState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const SETS: &str = "telegram_sticker_sets";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "setId")]
    pub set_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SetRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub title: String,
    #[serde(rename = "stickerType")]
    pub sticker_type: String,
    #[serde(rename = "stickerCount")]
    pub sticker_count: i64,
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
    pub sets: Vec<SetRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    /// Telegram pack short_name (e.g. `cats_by_yourbot`).
    pub name: String,
    pub title: String,
    /// "regular" | "mask" | "custom_emoji"
    #[serde(default, rename = "stickerType")]
    pub sticker_type: Option<String>,
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
fn dt(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
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

fn doc_to_row(d: &Document) -> Option<SetRow> {
    Some(SetRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        title: d.get_str("title").unwrap_or("").to_owned(),
        sticker_type: d.get_str("stickerType").unwrap_or("regular").to_owned(),
        sticker_count: d
            .get_i64("stickerCount")
            .or_else(|_| d.get_i32("stickerCount").map(i64::from))
            .unwrap_or(0),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                sets: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                sets: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(SETS)
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let sets = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp { sets, error: None })
}

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    if body.name.is_empty() || body.title.is_empty() {
        return err("name and title are required");
    }
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
    let now = bson::DateTime::now();
    let doc = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "name": &body.name,
        "title": &body.title,
        "stickerType": body.sticker_type.unwrap_or_else(|| "regular".to_owned()),
        "stickerCount": 0i64,
        "createdAt": now,
        "updatedAt": now,
    };
    match s.mongo.collection::<Document>(SETS).insert_one(doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                set_id: Some(id),
                message: Some("Sticker set tracked.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn delete_set(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_id): Path<String>,
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
    let oid = match parse_oid(&set_id) {
        Some(o) => o,
        None => return err("Invalid set id."),
    };
    match s
        .mongo
        .collection::<Document>(SETS)
        .delete_one(doc! { "_id": oid, "botId": bot_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            set_id: Some(set_id),
            message: Some("Sticker set untracked.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}
