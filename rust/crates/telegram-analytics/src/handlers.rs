//! Read-only Mongo aggregations across the Telegram crates.
//!
//! All endpoints require an authenticated `AuthUser` and a verified
//! `projectId`. Date-range parameters (`from`, `to`) are ISO-8601 UTC
//! strings; missing values default to (now - 30d, now).
//!
//! ## Collection assumptions
//!
//! These names mirror the constants in the sibling Telegram crates so
//! aggregations stay aligned even if a crate hasn't started populating
//! its collection yet — missing data simply yields zero counters:
//!
//! | Collection             | Owning crate              |
//! |------------------------|---------------------------|
//! | `telegram_bots`        | `telegram-bots`           |
//! | `telegram_chats`       | `telegram-chats`          |
//! | `telegram_messages`    | `telegram-chats`          |
//! | `telegram_broadcasts`  | `telegram-broadcasts`     |
//! | `telegram_invoices`    | `telegram-payments`       |
//! | `telegram_auto_replies`| `telegram-auto-reply`     |
//!
//! Commands are stored per-bot inside `telegram_bots.commands`
//! (managed by `telegram-commands`); see `top_commands` for how those
//! are surfaced. There is no command-invocation log yet — see
//! INTEGRATION NOTES on the page.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::state::TelegramAnalyticsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHATS: &str = "telegram_chats";
const MESSAGES: &str = "telegram_messages";
const BROADCASTS: &str = "telegram_broadcasts";
const INVOICES: &str = "telegram_payment_invoices";
const AUTO_REPLIES: &str = "telegram_auto_reply_rules";

// -------------------------------------------------------------------------
//  Shared helpers
// -------------------------------------------------------------------------

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

/// Parse an ISO-8601 string. Returns `None` for empty/missing/invalid input.
fn parse_iso(s: Option<&str>) -> Option<DateTime<Utc>> {
    let s = s?.trim();
    if s.is_empty() {
        return None;
    }
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            // Fall back to RFC-2822 / date-only "YYYY-MM-DD".
            DateTime::parse_from_str(&format!("{s}T00:00:00Z"), "%Y-%m-%dT%H:%M:%SZ")
                .ok()
                .map(|d| d.with_timezone(&Utc))
        })
}

/// Resolve a `(from, to)` window with a 30-day default and a 1-year cap.
fn resolve_range(from: Option<&str>, to: Option<&str>) -> (DateTime<Utc>, DateTime<Utc>) {
    let now = Utc::now();
    let mut to_dt = parse_iso(to).unwrap_or(now);
    let mut from_dt = parse_iso(from).unwrap_or_else(|| to_dt - Duration::days(30));
    if from_dt > to_dt {
        std::mem::swap(&mut from_dt, &mut to_dt);
    }
    // Cap at 366 days to keep aggregations bounded.
    let max_span = Duration::days(366);
    if to_dt - from_dt > max_span {
        from_dt = to_dt - max_span;
    }
    (from_dt, to_dt)
}

fn i64_of(d: &Document, key: &str) -> i64 {
    d.get_i64(key)
        .or_else(|_| d.get_i32(key).map(i64::from))
        .or_else(|_| d.get_f64(key).map(|x| x as i64))
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Granularity {
    Hour,
    #[default]
    Day,
    Week,
}

impl Granularity {
    fn mongo_format(self) -> &'static str {
        match self {
            Granularity::Hour => "%Y-%m-%dT%H:00:00Z",
            Granularity::Day => "%Y-%m-%d",
            Granularity::Week => "%G-W%V",
        }
    }
}

// -------------------------------------------------------------------------
//  Date-range query shared by most endpoints
// -------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct RangeQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TimeseriesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub granularity: Option<Granularity>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TopQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CsvQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    /// One of `overview` (default), `messages`, `broadcasts`, `commands`.
    #[serde(default)]
    pub section: Option<String>,
}

// =========================================================================
//  Legacy /overview (last 24h, no date range) — kept for backwards compat
//  with existing dashboards. The new analytics page calls /overview with
//  date range to get the rich shape; the legacy shape is detected by the
//  absence of `from`/`to` and returned alongside.
//
//  Both shapes are returned in a single envelope to avoid breaking the
//  current consumer; old fields stay at the top level.
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct BotsBreakdown {
    pub total: i64,
    pub active: i64,
    pub errored: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct MessagesBreakdown {
    pub incoming: i64,
    pub outgoing: i64,
    #[serde(rename = "byDay")]
    pub by_day: Vec<TimeBucket>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BroadcastsBreakdown {
    pub sent: i64,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
    #[serde(rename = "topErrorCodes")]
    pub top_error_codes: Vec<KeyCount>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct PaymentsBreakdown {
    pub count: i64,
    #[serde(rename = "sumCents")]
    pub sum_cents: i64,
    #[serde(rename = "currencyBreakdown")]
    pub currency_breakdown: Vec<KeyCount>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct CommandsBreakdown {
    pub top: Vec<KeyCount>,
    pub total: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AutoReplyBreakdown {
    /// Rules currently active (proxy for "fired", since per-fire logs
    /// don't exist yet).
    pub fired: i64,
    pub top: Vec<KeyCount>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ContactsBreakdown {
    pub total: i64,
    #[serde(rename = "newThisPeriod")]
    pub new_this_period: i64,
    /// Contacts with no activity in the last 30 days.
    pub lost: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ChatsBreakdown {
    #[serde(rename = "activeThisPeriod")]
    pub active_this_period: i64,
    #[serde(rename = "newThisPeriod")]
    pub new_this_period: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct TimeBucket {
    /// Bucket label (`YYYY-MM-DD`, `YYYY-MM-DDTHH:00:00Z`, or `YYYY-Www`).
    pub ts: String,
    #[serde(rename = "in")]
    pub incoming: i64,
    pub out: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BroadcastTimeBucket {
    pub ts: String,
    pub sent: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct KeyCount {
    pub key: String,
    pub label: String,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ContactSummary {
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub title: String,
    pub messages: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct OverviewResp {
    // ---- legacy fields (kept so the old dashboard call still works) ----
    pub bots: i64,
    #[serde(rename = "activeChats")]
    pub active_chats: i64,
    pub broadcasts: i64,

    // ---- new structured shape consumed by the new analytics page ----
    #[serde(rename = "botsBreakdown", skip_serializing_if = "Option::is_none")]
    pub bots_breakdown: Option<BotsBreakdown>,
    #[serde(rename = "messagesBreakdown", skip_serializing_if = "Option::is_none")]
    pub messages_breakdown: Option<MessagesBreakdown>,
    #[serde(
        rename = "broadcastsBreakdown",
        skip_serializing_if = "Option::is_none"
    )]
    pub broadcasts_breakdown: Option<BroadcastsBreakdown>,
    #[serde(rename = "paymentsBreakdown", skip_serializing_if = "Option::is_none")]
    pub payments_breakdown: Option<PaymentsBreakdown>,
    #[serde(rename = "commandsBreakdown", skip_serializing_if = "Option::is_none")]
    pub commands_breakdown: Option<CommandsBreakdown>,
    #[serde(rename = "autoReplyBreakdown", skip_serializing_if = "Option::is_none")]
    pub auto_reply_breakdown: Option<AutoReplyBreakdown>,
    #[serde(rename = "contactsBreakdown", skip_serializing_if = "Option::is_none")]
    pub contacts_breakdown: Option<ContactsBreakdown>,
    #[serde(rename = "chatsBreakdown", skip_serializing_if = "Option::is_none")]
    pub chats_breakdown: Option<ChatsBreakdown>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// -------------------------------------------------------------------------
//  Bot filter helper — when a botId is supplied, narrow project queries.
// -------------------------------------------------------------------------

async fn resolve_bot_filter(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_id: Option<&str>,
) -> Result<Option<ObjectId>, String> {
    let Some(b) = bot_id else { return Ok(None) };
    if b.is_empty() {
        return Ok(None);
    }
    let bot = require_bot(user, mongo, b).await?;
    let bot_project = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    if bot_project != project_oid {
        return Err("Bot does not belong to this project.".to_owned());
    }
    let bot_oid = bot
        .get_object_id("_id")
        .map_err(|_| "bot is malformed".to_owned())?;
    Ok(Some(bot_oid))
}

/// Scope filter for sibling collections (`telegram_messages`, `_chats`,
/// `_broadcasts`, `_invoices`, `_auto_replies`) whose docs carry both
/// `projectId` and `botId`.
fn scope_doc(project_oid: ObjectId, bot_oid: Option<ObjectId>) -> Document {
    let mut d = doc! { "projectId": project_oid };
    if let Some(b) = bot_oid {
        d.insert("botId", b);
    }
    d
}

/// Scope filter for the `telegram_bots` collection itself, where the
/// bot's primary key is `_id` (not `botId`). Use this instead of
/// `scope_doc` for any query that targets `telegram_bots`.
fn bots_scope_doc(project_oid: ObjectId, bot_oid: Option<ObjectId>) -> Document {
    let mut d = doc! { "projectId": project_oid };
    if let Some(b) = bot_oid {
        d.insert("_id", b);
    }
    d
}

// =========================================================================
//  GET /v1/telegram/analytics/overview
// =========================================================================

pub async fn overview(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<RangeQuery>,
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
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(OverviewResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let from_bson = bson::DateTime::from_chrono(from_dt);
    let to_bson = bson::DateTime::from_chrono(to_dt);
    let since_24h = bson::DateTime::from_chrono(Utc::now() - Duration::hours(24));
    let lost_cutoff = bson::DateTime::from_chrono(Utc::now() - Duration::days(30));

    // ---- bots: total / active / errored ----
    // Bot-scope filter uses `_id` for the `telegram_bots` collection.
    let bots_filter = bots_scope_doc(project_oid, bot_oid);
    let bots_total = s
        .mongo
        .collection::<Document>(BOTS)
        .count_documents(bots_filter.clone())
        .await
        .unwrap_or(0) as i64;
    let mut active_filter = bots_filter.clone();
    active_filter.insert("isActive", doc! { "$ne": false });
    let bots_active = s
        .mongo
        .collection::<Document>(BOTS)
        .count_documents(active_filter)
        .await
        .unwrap_or(0) as i64;
    let mut errored_filter = bots_filter.clone();
    errored_filter.insert(
        "webhookInfo.lastErrorMessage",
        doc! { "$exists": true, "$nin": [bson::Bson::Null, bson::Bson::String(String::new())] },
    );
    let bots_errored = s
        .mongo
        .collection::<Document>(BOTS)
        .count_documents(errored_filter)
        .await
        .unwrap_or(0) as i64;

    // Sibling-collection scope uses `botId` and applies to messages,
    // chats, broadcasts, invoices, and auto-reply rules.
    let bots_scope = scope_doc(project_oid, bot_oid);

    // ---- messages: in / out / by-day ----
    let messages_match = {
        let mut m = bots_scope.clone();
        m.insert("createdAt", doc! { "$gte": from_bson, "$lte": to_bson });
        m
    };
    let messages = s.mongo.collection::<Document>(MESSAGES);
    let incoming = messages
        .count_documents({
            let mut f = messages_match.clone();
            f.insert("direction", "inbound");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let outgoing = messages
        .count_documents({
            let mut f = messages_match.clone();
            f.insert("direction", "outbound");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let by_day = aggregate_message_buckets(&messages, &messages_match, Granularity::Day).await;

    // ---- broadcasts: sent / success rate / top error codes ----
    let broadcasts_match = {
        let mut m = bots_scope.clone();
        m.insert("createdAt", doc! { "$gte": from_bson, "$lte": to_bson });
        m
    };
    let broadcasts_coll = s.mongo.collection::<Document>(BROADCASTS);
    let broadcasts_total = broadcasts_coll
        .count_documents(broadcasts_match.clone())
        .await
        .unwrap_or(0) as i64;
    let (b_sent, b_failed, top_error_codes) =
        broadcast_stats(&broadcasts_coll, &broadcasts_match).await;
    let success_rate = {
        let denom = (b_sent + b_failed) as f64;
        if denom > 0.0 {
            (b_sent as f64) / denom
        } else {
            0.0
        }
    };

    // ---- payments: count / sumCents / currency breakdown ----
    let payments_match = {
        let mut m = bots_scope.clone();
        m.insert("createdAt", doc! { "$gte": from_bson, "$lte": to_bson });
        m.insert("status", doc! { "$ne": "open" }); // count completed/refunded
        m
    };
    let payments_coll = s.mongo.collection::<Document>(INVOICES);
    let (p_count, p_sum, currency_breakdown) =
        payments_stats(&payments_coll, &payments_match).await;

    // ---- commands: top commands invoked. We don't have an
    // invocation log, so we surface the commands declared per bot
    // weighted by bot count as a best-effort.
    let (commands_top, commands_total) = commands_summary(&s.mongo, project_oid, bot_oid).await;

    // ---- auto-reply: rules fired (proxy = active rules) + top by name ----
    let (ar_fired, ar_top) = auto_reply_summary(&s.mongo, project_oid, bot_oid).await;

    // ---- contacts: total / new / lost ----
    let contacts_coll = s.mongo.collection::<Document>(CHATS);
    let contacts_total = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("type", "private");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let new_this_period = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("type", "private");
            f.insert("createdAt", doc! { "$gte": from_bson, "$lte": to_bson });
            f
        })
        .await
        .unwrap_or(0) as i64;
    let lost = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("type", "private");
            f.insert(
                "$or",
                bson::Bson::Array(vec![
                    bson::Bson::Document(doc! { "lastMessageAt": { "$lt": lost_cutoff } }),
                    bson::Bson::Document(doc! { "lastMessageAt": bson::Bson::Null }),
                ]),
            );
            f
        })
        .await
        .unwrap_or(0) as i64;

    // ---- chats: active / new in range ----
    let chats_active = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("lastMessageAt", doc! { "$gte": from_bson, "$lte": to_bson });
            f
        })
        .await
        .unwrap_or(0) as i64;
    let chats_new = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("createdAt", doc! { "$gte": from_bson, "$lte": to_bson });
            f
        })
        .await
        .unwrap_or(0) as i64;

    // ---- legacy fields ----
    let active_chats_24h = contacts_coll
        .count_documents({
            let mut f = bots_scope.clone();
            f.insert("lastMessageAt", doc! { "$gte": since_24h });
            f
        })
        .await
        .unwrap_or(0) as i64;

    Json(OverviewResp {
        bots: bots_total,
        active_chats: active_chats_24h,
        broadcasts: broadcasts_total,
        bots_breakdown: Some(BotsBreakdown {
            total: bots_total,
            active: bots_active,
            errored: bots_errored,
        }),
        messages_breakdown: Some(MessagesBreakdown {
            incoming,
            outgoing,
            by_day,
        }),
        broadcasts_breakdown: Some(BroadcastsBreakdown {
            sent: b_sent,
            success_rate,
            top_error_codes,
        }),
        payments_breakdown: Some(PaymentsBreakdown {
            count: p_count,
            sum_cents: p_sum,
            currency_breakdown,
        }),
        commands_breakdown: Some(CommandsBreakdown {
            top: commands_top,
            total: commands_total,
        }),
        auto_reply_breakdown: Some(AutoReplyBreakdown {
            fired: ar_fired,
            top: ar_top,
        }),
        contacts_breakdown: Some(ContactsBreakdown {
            total: contacts_total,
            new_this_period,
            lost,
        }),
        chats_breakdown: Some(ChatsBreakdown {
            active_this_period: chats_active,
            new_this_period: chats_new,
        }),
        error: None,
    })
}

// -------------------------------------------------------------------------
//  Sub-aggregations used by both overview and the dedicated endpoints.
// -------------------------------------------------------------------------

async fn aggregate_message_buckets(
    messages: &mongodb::Collection<Document>,
    match_doc: &Document,
    granularity: Granularity,
) -> Vec<TimeBucket> {
    let fmt = granularity.mongo_format();
    let pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! {
            "$group": {
                "_id": {
                    "ts": { "$dateToString": { "format": fmt, "date": "$createdAt" } },
                    "direction": "$direction",
                },
                "count": { "$sum": 1 },
            }
        },
    ];
    let docs: Vec<Document> = match messages.aggregate(pipeline).await {
        Ok(c) => c.try_collect().await.unwrap_or_default(),
        Err(e) => {
            tracing::warn!("messages aggregate failed: {e}");
            Vec::new()
        }
    };
    let mut by_bucket: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    for d in docs {
        let Ok(id) = d.get_document("_id") else {
            continue;
        };
        let ts = id.get_str("ts").unwrap_or("").to_owned();
        let direction = id.get_str("direction").unwrap_or("").to_owned();
        let count = i64_of(&d, "count");
        let entry = by_bucket.entry(ts).or_insert((0, 0));
        match direction.as_str() {
            "inbound" => entry.0 += count,
            "outbound" => entry.1 += count,
            _ => {}
        }
    }
    by_bucket
        .into_iter()
        .map(|(ts, (inc, out))| TimeBucket {
            ts,
            incoming: inc,
            out,
        })
        .collect()
}

async fn aggregate_broadcast_buckets(
    broadcasts: &mongodb::Collection<Document>,
    match_doc: &Document,
    granularity: Granularity,
) -> Vec<BroadcastTimeBucket> {
    let fmt = granularity.mongo_format();
    let pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! {
            "$group": {
                "_id": { "$dateToString": { "format": fmt, "date": "$createdAt" } },
                "sent": { "$sum": { "$ifNull": ["$stats.sent", 0i64] } },
                "failed": { "$sum": { "$ifNull": ["$stats.failed", 0i64] } },
            }
        },
        doc! { "$sort": { "_id": 1 } },
    ];
    let docs: Vec<Document> = match broadcasts.aggregate(pipeline).await {
        Ok(c) => c.try_collect().await.unwrap_or_default(),
        Err(e) => {
            tracing::warn!("broadcasts aggregate failed: {e}");
            Vec::new()
        }
    };
    docs.into_iter()
        .filter_map(|d| {
            let ts = d.get_str("_id").ok()?.to_owned();
            Some(BroadcastTimeBucket {
                ts,
                sent: i64_of(&d, "sent"),
                failed: i64_of(&d, "failed"),
            })
        })
        .collect()
}

async fn broadcast_stats(
    broadcasts: &mongodb::Collection<Document>,
    match_doc: &Document,
) -> (i64, i64, Vec<KeyCount>) {
    let pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! {
            "$group": {
                "_id": null,
                "sent": { "$sum": { "$ifNull": ["$stats.sent", 0i64] } },
                "failed": { "$sum": { "$ifNull": ["$stats.failed", 0i64] } },
            }
        },
    ];
    let mut sent = 0i64;
    let mut failed = 0i64;
    if let Ok(c) = broadcasts.aggregate(pipeline).await {
        let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
        if let Some(d) = docs.first() {
            sent = i64_of(d, "sent");
            failed = i64_of(d, "failed");
        }
    }

    // Top error codes: when broadcasts persist per-recipient errors,
    // they live under `stats.errors[].code`. Until that's standardised
    // we fall back to a top-level `lastError` string field.
    let err_pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! { "$match": { "lastError": { "$exists": true, "$ne": "" } } },
        doc! { "$group": { "_id": "$lastError", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": 10 },
    ];
    let mut top: Vec<KeyCount> = Vec::new();
    if let Ok(c) = broadcasts.aggregate(err_pipeline).await {
        let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
        for d in docs {
            let key = d.get_str("_id").unwrap_or("").to_owned();
            if key.is_empty() {
                continue;
            }
            top.push(KeyCount {
                key: key.clone(),
                label: key,
                count: i64_of(&d, "count"),
            });
        }
    }
    (sent, failed, top)
}

async fn payments_stats(
    invoices: &mongodb::Collection<Document>,
    match_doc: &Document,
) -> (i64, i64, Vec<KeyCount>) {
    let pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! {
            "$group": {
                "_id": "$currency",
                "count": { "$sum": 1 },
                "sum": { "$sum": { "$ifNull": ["$amount", 0i64] } },
            }
        },
        doc! { "$sort": { "sum": -1 } },
    ];
    let mut total_count = 0i64;
    let mut total_sum = 0i64;
    let mut breakdown: Vec<KeyCount> = Vec::new();
    if let Ok(c) = invoices.aggregate(pipeline).await {
        let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
        for d in docs {
            let count = i64_of(&d, "count");
            let sum = i64_of(&d, "sum");
            let currency = d.get_str("_id").unwrap_or("???").to_owned();
            total_count += count;
            total_sum += sum;
            breakdown.push(KeyCount {
                key: currency.clone(),
                label: format!("{currency} ({sum})"),
                count,
            });
        }
    }
    (total_count, total_sum, breakdown)
}

async fn commands_summary(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
) -> (Vec<KeyCount>, i64) {
    // No per-invocation log yet — surface declared commands per project
    // (or per bot if filtered), counting how many bots declare each one.
    let mut match_doc = doc! { "projectId": project_oid };
    if let Some(b) = bot_oid {
        match_doc.insert("_id", b);
    }
    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$unwind": { "path": "$commands", "preserveNullAndEmptyArrays": false } },
        doc! {
            "$group": {
                "_id": "$commands.command",
                "label": { "$first": "$commands.description" },
                "count": { "$sum": 1 },
            }
        },
        doc! { "$sort": { "count": -1, "_id": 1 } },
        doc! { "$limit": 20 },
    ];
    let mut top: Vec<KeyCount> = Vec::new();
    let mut total = 0i64;
    if let Ok(c) = mongo.collection::<Document>(BOTS).aggregate(pipeline).await {
        let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
        for d in docs {
            let key = d.get_str("_id").unwrap_or("").to_owned();
            if key.is_empty() {
                continue;
            }
            let count = i64_of(&d, "count");
            total += count;
            let label = d
                .get_str("label")
                .ok()
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .unwrap_or_else(|| format!("/{key}"));
            top.push(KeyCount { key, label, count });
        }
    }
    (top, total)
}

async fn auto_reply_summary(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
) -> (i64, Vec<KeyCount>) {
    let mut match_doc = doc! { "projectId": project_oid };
    if let Some(b) = bot_oid {
        match_doc.insert("botId", b);
    }
    let rules_coll = mongo.collection::<Document>(AUTO_REPLIES);

    let mut active_filter = match_doc.clone();
    active_filter.insert("isActive", doc! { "$ne": false });
    let fired = rules_coll.count_documents(active_filter).await.unwrap_or(0) as i64;

    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$group": {
            "_id": "$_id",
            "name": { "$first": "$name" },
            "fires": { "$sum": { "$ifNull": ["$stats.fires", 0i64] } },
        } },
        doc! { "$sort": { "fires": -1 } },
        doc! { "$limit": 10 },
    ];
    let mut top: Vec<KeyCount> = Vec::new();
    if let Ok(c) = rules_coll.aggregate(pipeline).await {
        let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
        for d in docs {
            let key = d
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default();
            if key.is_empty() {
                continue;
            }
            let label = d
                .get_str("name")
                .ok()
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .unwrap_or_else(|| key.clone());
            top.push(KeyCount {
                key,
                label,
                count: i64_of(&d, "fires"),
            });
        }
    }
    (fired, top)
}

// =========================================================================
//  GET /v1/telegram/analytics/messages-timeseries
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct TimeseriesResp {
    pub series: Vec<TimeBucket>,
    pub granularity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn messages_timeseries(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<TimeseriesQuery>,
) -> Json<TimeseriesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(TimeseriesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TimeseriesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(TimeseriesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let granularity = q.granularity.unwrap_or_default();
    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let mut match_doc = scope_doc(project_oid, bot_oid);
    match_doc.insert(
        "createdAt",
        doc! { "$gte": bson::DateTime::from_chrono(from_dt), "$lte": bson::DateTime::from_chrono(to_dt) },
    );

    let series = aggregate_message_buckets(
        &s.mongo.collection::<Document>(MESSAGES),
        &match_doc,
        granularity,
    )
    .await;
    Json(TimeseriesResp {
        series,
        granularity: granularity_label(granularity),
        error: None,
    })
}

fn granularity_label(g: Granularity) -> String {
    match g {
        Granularity::Hour => "hour".to_owned(),
        Granularity::Day => "day".to_owned(),
        Granularity::Week => "week".to_owned(),
    }
}

// =========================================================================
//  GET /v1/telegram/analytics/broadcasts-timeseries
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct BroadcastTimeseriesResp {
    pub series: Vec<BroadcastTimeBucket>,
    pub granularity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn broadcasts_timeseries(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<TimeseriesQuery>,
) -> Json<BroadcastTimeseriesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(BroadcastTimeseriesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BroadcastTimeseriesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(BroadcastTimeseriesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let granularity = q.granularity.unwrap_or_default();
    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let mut match_doc = scope_doc(project_oid, bot_oid);
    match_doc.insert(
        "createdAt",
        doc! { "$gte": bson::DateTime::from_chrono(from_dt), "$lte": bson::DateTime::from_chrono(to_dt) },
    );

    let series = aggregate_broadcast_buckets(
        &s.mongo.collection::<Document>(BROADCASTS),
        &match_doc,
        granularity,
    )
    .await;
    Json(BroadcastTimeseriesResp {
        series,
        granularity: granularity_label(granularity),
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/analytics/top-contacts
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct TopContactsResp {
    pub contacts: Vec<ContactSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn top_contacts(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<TopQuery>,
) -> Json<TopContactsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(TopContactsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TopContactsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(TopContactsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let mut match_doc = scope_doc(project_oid, bot_oid);
    match_doc.insert(
        "createdAt",
        doc! { "$gte": bson::DateTime::from_chrono(from_dt), "$lte": bson::DateTime::from_chrono(to_dt) },
    );

    let pipeline = vec![
        doc! { "$match": match_doc.clone() },
        doc! { "$group": { "_id": "$chatId", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": limit },
    ];
    let docs: Vec<Document> = match s
        .mongo
        .collection::<Document>(MESSAGES)
        .aggregate(pipeline)
        .await
    {
        Ok(c) => c.try_collect().await.unwrap_or_default(),
        Err(e) => {
            return Json(TopContactsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let chat_ids: Vec<String> = docs
        .iter()
        .filter_map(|d| d.get_str("_id").ok().map(str::to_owned))
        .collect();
    let chats_coll = s.mongo.collection::<Document>(CHATS);
    let chat_docs: Vec<Document> = if chat_ids.is_empty() {
        Vec::new()
    } else {
        let mut filter = scope_doc(project_oid, bot_oid);
        filter.insert("chatId", doc! { "$in": &chat_ids });
        match chats_coll.find(filter).await {
            Ok(c) => c.try_collect().await.unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    };
    let title_for = |id: &str| -> String {
        for c in &chat_docs {
            if c.get_str("chatId").ok() == Some(id) {
                return chat_title(c, id);
            }
        }
        id.to_owned()
    };
    let contacts: Vec<ContactSummary> = docs
        .iter()
        .filter_map(|d| {
            let id = d.get_str("_id").ok()?;
            Some(ContactSummary {
                chat_id: id.to_owned(),
                title: title_for(id),
                messages: i64_of(d, "count"),
            })
        })
        .collect();

    Json(TopContactsResp {
        contacts,
        error: None,
    })
}

fn chat_title(d: &Document, fallback: &str) -> String {
    let title = d.get_str("title").ok().map(str::to_owned);
    let username = d.get_str("username").ok().map(str::to_owned);
    let first = d.get_str("firstName").ok().unwrap_or("").to_owned();
    let last = d.get_str("lastName").ok().unwrap_or("").to_owned();
    let full = format!("{first} {last}").trim().to_owned();
    title
        .filter(|s| !s.is_empty())
        .or(username.filter(|s| !s.is_empty()))
        .or(if full.is_empty() { None } else { Some(full) })
        .unwrap_or_else(|| fallback.to_owned())
}

// =========================================================================
//  GET /v1/telegram/analytics/top-commands
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct TopCommandsResp {
    pub commands: Vec<KeyCount>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn top_commands(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<TopQuery>,
) -> Json<TopCommandsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(TopCommandsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TopCommandsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(TopCommandsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let (mut commands, _total) = commands_summary(&s.mongo, project_oid, bot_oid).await;
    commands.truncate(limit as usize);
    Json(TopCommandsResp {
        commands,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/analytics/funnel
//
//  contactedBot   = distinct private chats that sent at least one inbound msg
//  replied        = of those, chats that received at least one outbound msg
//  completedFlow  = chats with `tags` containing "flow:completed" (best effort)
//  paid           = distinct chats with a non-open invoice
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct FunnelResp {
    #[serde(rename = "contactedBot")]
    pub contacted_bot: i64,
    pub replied: i64,
    #[serde(rename = "completedFlow")]
    pub completed_flow: i64,
    pub paid: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn funnel(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<RangeQuery>,
) -> Json<FunnelResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(FunnelResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(FunnelResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(FunnelResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let from_b = bson::DateTime::from_chrono(from_dt);
    let to_b = bson::DateTime::from_chrono(to_dt);

    let messages = s.mongo.collection::<Document>(MESSAGES);
    let mut inbound_match = scope_doc(project_oid, bot_oid);
    inbound_match.insert("direction", "inbound");
    inbound_match.insert("createdAt", doc! { "$gte": from_b, "$lte": to_b });
    let contacted = distinct_chat_count(&messages, inbound_match).await;

    let mut outbound_match = scope_doc(project_oid, bot_oid);
    outbound_match.insert("direction", "outbound");
    outbound_match.insert("createdAt", doc! { "$gte": from_b, "$lte": to_b });
    let replied = distinct_chat_count(&messages, outbound_match).await;

    let chats = s.mongo.collection::<Document>(CHATS);
    let mut completed_match = scope_doc(project_oid, bot_oid);
    completed_match.insert("tags", "flow:completed");
    completed_match.insert("updatedAt", doc! { "$gte": from_b, "$lte": to_b });
    let completed_flow = chats.count_documents(completed_match).await.unwrap_or(0) as i64;

    let invoices = s.mongo.collection::<Document>(INVOICES);
    let mut paid_match = scope_doc(project_oid, bot_oid);
    paid_match.insert("status", doc! { "$ne": "open" });
    paid_match.insert("createdAt", doc! { "$gte": from_b, "$lte": to_b });
    let paid = invoices.count_documents(paid_match).await.unwrap_or(0) as i64;

    Json(FunnelResp {
        contacted_bot: contacted,
        replied,
        completed_flow,
        paid,
        error: None,
    })
}

async fn distinct_chat_count(messages: &mongodb::Collection<Document>, match_doc: Document) -> i64 {
    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$group": { "_id": "$chatId" } },
        doc! { "$count": "n" },
    ];
    match messages.aggregate(pipeline).await {
        Ok(c) => {
            let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
            docs.first().map(|d| i64_of(d, "n")).unwrap_or(0)
        }
        Err(_) => 0,
    }
}

// =========================================================================
//  GET /v1/telegram/analytics/export.csv
// =========================================================================

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramAnalyticsState>,
    Query(q): Query<CsvQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return csv_error("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return csv_error(&e),
    };
    let bot_oid = match resolve_bot_filter(&user, &s.mongo, project_oid, q.bot_id.as_deref()).await
    {
        Ok(o) => o,
        Err(e) => return csv_error(&e),
    };
    let (from_dt, to_dt) = resolve_range(q.from.as_deref(), q.to.as_deref());
    let section = q.section.as_deref().unwrap_or("overview");

    let from_b = bson::DateTime::from_chrono(from_dt);
    let to_b = bson::DateTime::from_chrono(to_dt);
    let mut scope = scope_doc(project_oid, bot_oid);
    scope.insert("createdAt", doc! { "$gte": from_b, "$lte": to_b });

    let body = match section {
        "messages" => {
            let series = aggregate_message_buckets(
                &s.mongo.collection::<Document>(MESSAGES),
                &scope,
                Granularity::Day,
            )
            .await;
            let mut csv = String::from("date,incoming,outgoing\n");
            for b in series {
                csv.push_str(&format!("{},{},{}\n", csv_escape(&b.ts), b.incoming, b.out));
            }
            csv
        }
        "broadcasts" => {
            let series = aggregate_broadcast_buckets(
                &s.mongo.collection::<Document>(BROADCASTS),
                &scope,
                Granularity::Day,
            )
            .await;
            let mut csv = String::from("date,sent,failed\n");
            for b in series {
                csv.push_str(&format!("{},{},{}\n", csv_escape(&b.ts), b.sent, b.failed));
            }
            csv
        }
        "commands" => {
            let (top, _) = commands_summary(&s.mongo, project_oid, bot_oid).await;
            let mut csv = String::from("command,description,count\n");
            for k in top {
                csv.push_str(&format!(
                    "{},{},{}\n",
                    csv_escape(&k.key),
                    csv_escape(&k.label),
                    k.count
                ));
            }
            csv
        }
        _ => {
            // overview — flatten the JSON shape into a key/value CSV.
            let resp =
                overview_payload(&s.mongo, &user, project_oid, bot_oid, from_dt, to_dt).await;
            let mut csv = String::from("metric,value\n");
            csv.push_str(&format!("bots_total,{}\n", resp.bots));
            csv.push_str(&format!("bots_active_24h_chats,{}\n", resp.active_chats));
            csv.push_str(&format!("broadcasts_total,{}\n", resp.broadcasts));
            if let Some(m) = &resp.messages_breakdown {
                csv.push_str(&format!("messages_in,{}\n", m.incoming));
                csv.push_str(&format!("messages_out,{}\n", m.outgoing));
            }
            if let Some(b) = &resp.broadcasts_breakdown {
                csv.push_str(&format!("broadcasts_sent,{}\n", b.sent));
                csv.push_str(&format!("broadcasts_success_rate,{:.4}\n", b.success_rate));
            }
            if let Some(p) = &resp.payments_breakdown {
                csv.push_str(&format!("payments_count,{}\n", p.count));
                csv.push_str(&format!("payments_sum_cents,{}\n", p.sum_cents));
            }
            if let Some(c) = &resp.contacts_breakdown {
                csv.push_str(&format!("contacts_total,{}\n", c.total));
                csv.push_str(&format!("contacts_new,{}\n", c.new_this_period));
                csv.push_str(&format!("contacts_lost,{}\n", c.lost));
            }
            csv
        }
    };

    let filename = format!(
        "telegram-analytics-{}-{}-{}.csv",
        section,
        from_dt.format("%Y%m%d"),
        to_dt.format("%Y%m%d"),
    );
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
            (header::CACHE_CONTROL, "no-store".to_owned()),
        ],
        body,
    )
        .into_response()
}

fn csv_error(msg: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        [(header::CONTENT_TYPE, "text/csv; charset=utf-8")],
        format!("error\n{}\n", csv_escape(msg)),
    )
        .into_response()
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        let escaped = s.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        s.to_owned()
    }
}

async fn overview_payload(
    mongo: &MongoHandle,
    user: &AuthUser,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> OverviewResp {
    // Cheap rebuild: call the same handler logic with a synthesised query
    // that mirrors the caller's date range and bot scope.
    let q = RangeQuery {
        project_id: Some(project_oid.to_hex()),
        from: Some(from.to_rfc3339()),
        to: Some(to.to_rfc3339()),
        bot_id: bot_oid.map(|o| o.to_hex()),
    };
    let state = TelegramAnalyticsState::new(mongo.clone());
    let Json(resp) = overview(user.clone(), State(state), Query(q)).await;
    resp
}

// =========================================================================
//  Legacy per-bot endpoint — unchanged signature, retained for callers.
// =========================================================================

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
        .count_documents(
            doc! { "botId": bot_oid, "direction": "inbound", "createdAt": { "$gte": since } },
        )
        .await
        .unwrap_or(0) as i64;
    let outbound = msgs
        .count_documents(
            doc! { "botId": bot_oid, "direction": "outbound", "createdAt": { "$gte": since } },
        )
        .await
        .unwrap_or(0) as i64;
    let chat_count = chats
        .count_documents(doc! { "botId": bot_oid, "lastMessageAt": { "$gte": since } })
        .await
        .unwrap_or(0) as i64;

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
    let series: Vec<Document> = match msgs.aggregate(pipeline).await {
        Ok(c) => c.try_collect().await.unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    let mut by_date: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    for d in series {
        let Ok(id) = d.get_document("_id") else {
            continue;
        };
        let date = id.get_str("date").unwrap_or("").to_owned();
        let direction = id.get_str("direction").unwrap_or("").to_owned();
        let count = i64_of(&d, "count");
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

    let pipeline_top = vec![
        doc! { "$match": { "botId": bot_oid, "createdAt": { "$gte": since } } },
        doc! { "$group": { "_id": "$chatId", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": 10 },
    ];
    let top_raw: Vec<Document> = match msgs.aggregate(pipeline_top).await {
        Ok(c) => c.try_collect().await.unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    let chat_ids: Vec<String> = top_raw
        .iter()
        .filter_map(|d| d.get_str("_id").ok().map(str::to_owned))
        .collect();
    let chat_docs: Vec<Document> = if chat_ids.is_empty() {
        Vec::new()
    } else {
        match chats
            .find(doc! { "botId": bot_oid, "chatId": { "$in": &chat_ids } })
            .await
        {
            Ok(c) => c.try_collect().await.unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    };
    let title_for = |id: &str| -> String {
        for c in &chat_docs {
            if c.get_str("chatId").ok() == Some(id) {
                return chat_title(c, id);
            }
        }
        id.to_owned()
    };
    let top_chats: Vec<TopChat> = top_raw
        .iter()
        .filter_map(|d| {
            let id = d.get_str("_id").ok()?;
            Some(TopChat {
                chat_id: id.to_owned(),
                title: title_for(id),
                messages: i64_of(d, "count"),
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
