use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramAnalyticsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHATS: &str = "telegram_chats";
const MESSAGES: &str = "telegram_messages";
const BROADCASTS: &str = "telegram_broadcasts";

// -------------------------------------------------------------------------
//  Overview counters
// -------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct OverviewQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct OverviewResp {
    pub bots: i64,
    #[serde(rename = "activeChats")]
    pub active_chats: i64,
    pub broadcasts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

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

pub async fn overview(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<OverviewQuery>,
) -> Json<OverviewResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(OverviewResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(OverviewResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::hours(24));

    let bots = s
        .mongo
        .collection::<Document>(BOTS)
        .count_documents(doc! { "projectId": project_oid })
        .await
        .unwrap_or(0) as i64;
    let active_chats = s
        .mongo
        .collection::<Document>(CHATS)
        .count_documents(doc! { "projectId": project_oid, "lastMessageAt": { "$gte": since } })
        .await
        .unwrap_or(0) as i64;
    let broadcasts = s
        .mongo
        .collection::<Document>(BROADCASTS)
        .count_documents(doc! { "projectId": project_oid })
        .await
        .unwrap_or(0) as i64;

    Json(OverviewResp {
        bots,
        active_chats,
        broadcasts,
        error: None,
    })
}

// -------------------------------------------------------------------------
//  Per-bot analytics
// -------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct BotAnalyticsQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Totals {
    pub messages: i64,
    pub inbound: i64,
    pub outbound: i64,
    pub chats: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimeseriesPoint {
    pub date: String,
    pub inbound: i64,
    pub outbound: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TopChat {
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub title: String,
    pub messages: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BotAnalyticsResp {
    pub totals: Totals,
    pub timeseries: Vec<TimeseriesPoint>,
    #[serde(rename = "topChats")]
    pub top_chats: Vec<TopChat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn bot_analytics(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Path(bot_id): Path<String>,
    Query(q): Query<BotAnalyticsQuery>,
) -> Json<BotAnalyticsResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(BotAnalyticsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(BotAnalyticsResp {
                error: Some("bot is malformed".to_owned()),
                ..Default::default()
            });
        }
    };

    let days = q.days.unwrap_or(30).clamp(1, 90);
    let since_chrono = Utc::now() - Duration::days(days);
    let since = bson::DateTime::from_chrono(since_chrono);

    let msgs = s.mongo.collection::<Document>(MESSAGES);
    let chats = s.mongo.collection::<Document>(CHATS);

    let inbound = msgs
        .count_documents(doc! { "botId": bot_oid, "direction": "inbound", "createdAt": { "$gte": since } })
        .await
        .unwrap_or(0) as i64;
    let outbound = msgs
        .count_documents(doc! { "botId": bot_oid, "direction": "outbound", "createdAt": { "$gte": since } })
        .await
        .unwrap_or(0) as i64;
    let chat_count = chats
        .count_documents(doc! { "botId": bot_oid, "lastMessageAt": { "$gte": since } })
        .await
        .unwrap_or(0) as i64;

    // Timeseries: group by day + direction.
    let pipeline = vec![
        doc! { "$match": { "botId": bot_oid, "createdAt": { "$gte": since } } },
        doc! {
            "$group": {
                "_id": {
                    "date": { "$dateToString": { "format": "%Y-%m-%d", "date": "$createdAt" } },
                    "direction": "$direction",
                },
                "count": { "$sum": 1 },
            }
        },
    ];
    use futures::TryStreamExt;
    let series: Vec<Document> = msgs
        .aggregate(pipeline)
        .await
        .ok()
        .map(|c| c)
        .unwrap_or_else(|| panic!("aggregate returned None"))
        .try_collect()
        .await
        .unwrap_or_default();

    use std::collections::BTreeMap;
    let mut by_date: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    for d in series {
        let id = match d.get_document("_id") {
            Ok(x) => x,
            Err(_) => continue,
        };
        let date = id.get_str("date").unwrap_or("").to_owned();
        let direction = id.get_str("direction").unwrap_or("").to_owned();
        let count = d.get_i64("count").unwrap_or_else(|_| {
            d.get_i32("count").map(i64::from).unwrap_or(0)
        });
        let entry = by_date.entry(date).or_insert((0, 0));
        if direction == "inbound" {
            entry.0 += count;
        } else if direction == "outbound" {
            entry.1 += count;
        }
    }
    let timeseries: Vec<TimeseriesPoint> = by_date
        .into_iter()
        .map(|(date, (i, o))| TimeseriesPoint {
            date,
            inbound: i,
            outbound: o,
        })
        .collect();

    // Top chats by message count.
    let pipeline_top = vec![
        doc! { "$match": { "botId": bot_oid, "createdAt": { "$gte": since } } },
        doc! { "$group": { "_id": "$chatId", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": 10 },
    ];
    let top_raw: Vec<Document> = msgs
        .aggregate(pipeline_top)
        .await
        .ok()
        .map(|c| c)
        .unwrap_or_else(|| panic!("aggregate returned None"))
        .try_collect()
        .await
        .unwrap_or_default();

    let chat_ids: Vec<String> = top_raw
        .iter()
        .filter_map(|d| d.get_str("_id").ok().map(str::to_owned))
        .collect();
    let chat_docs: Vec<Document> = if chat_ids.is_empty() {
        vec![]
    } else {
        chats
            .find(doc! { "botId": bot_oid, "chatId": { "$in": &chat_ids } })
            .await
            .ok()
            .map(|c| c)
            .unwrap_or_else(|| panic!("find returned None"))
            .try_collect()
            .await
            .unwrap_or_default()
    };
    let title_for = |id: &str| -> String {
        for c in &chat_docs {
            if c.get_str("chatId").ok() == Some(id) {
                let title = c.get_str("title").ok().map(str::to_owned);
                let username = c.get_str("username").ok().map(str::to_owned);
                let first = c.get_str("firstName").ok().unwrap_or("").to_owned();
                let last = c.get_str("lastName").ok().unwrap_or("").to_owned();
                let full = [first, last].join(" ").trim().to_owned();
                return title
                    .filter(|s| !s.is_empty())
                    .or(username.filter(|s| !s.is_empty()))
                    .or(if full.is_empty() { None } else { Some(full) })
                    .unwrap_or_else(|| id.to_owned());
            }
        }
        id.to_owned()
    };
    let top_chats: Vec<TopChat> = top_raw
        .iter()
        .filter_map(|d| {
            let id = d.get_str("_id").ok()?;
            let count = d
                .get_i64("count")
                .or_else(|_| d.get_i32("count").map(i64::from))
                .ok()?;
            Some(TopChat {
                chat_id: id.to_owned(),
                title: title_for(id),
                messages: count,
            })
        })
        .collect();

    Json(BotAnalyticsResp {
        totals: Totals {
            messages: inbound + outbound,
            inbound,
            outbound,
            chats: chat_count,
        },
        timeseries,
        top_chats,
        error: None,
    })
}
