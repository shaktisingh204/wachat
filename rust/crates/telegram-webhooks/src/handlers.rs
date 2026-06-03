//! HTTP handlers for `telegram-webhooks`.
//!
//! Three layers:
//!  * **Subscriptions** — per-bot config of the live Telegram webhook
//!    (`telegram_webhook_subscriptions`). Edits drive Bot API
//!    `setWebhook` calls.
//!  * **Deliveries** — append-only log of every incoming update
//!    (`telegram_webhook_deliveries`). The Next.js receiver writes to
//!    this via `log_delivery` (exposed pub fn + JSON route).
//!  * **DLQ** — failed deliveries that need operator attention
//!    (`telegram_webhook_dlq`).
//!
//! Every external endpoint enforces tenant ownership via
//! `require_project` (mirrors the convention in telegram-bots/ads).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use futures::TryStreamExt;
use rand::RngCore;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::bot_api::{BotApiError, SetWebhookParams};
use crate::state::TelegramWebhooksState;

// ---------------------------------------------------------------------------
//  Mongo collection names
// ---------------------------------------------------------------------------

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const SUBS: &str = "telegram_webhook_subscriptions";
const DELIVERIES: &str = "telegram_webhook_deliveries";
const DLQ: &str = "telegram_webhook_dlq";

// ---------------------------------------------------------------------------
//  Generic ack envelope shared by mutating endpoints
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "subscriptionId")]
    pub subscription_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deliveryId")]
    pub delivery_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "dlqId")]
    pub dlq_id: Option<String>,
}

fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

fn dt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

fn dt_or_now(o: Option<bson::DateTime>) -> DateTime<Utc> {
    dt(o).unwrap_or_else(Utc::now)
}

fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()
                .and_then(|nd| nd.and_hms_opt(0, 0, 0))
                .map(|ndt| Utc.from_utc_datetime(&ndt))
        })
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

/// Load a bot doc and confirm it belongs to `project_oid`.
async fn require_bot(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_id: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id).ok_or_else(|| "invalid bot id".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    Ok(bot)
}

fn bot_api_err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => format!("telegram: {s}"),
        BotApiError::Transport(t) => format!("transport: {t}"),
    }
}

/// Public helper — generate a cryptographically random 32-byte
/// URL-safe-base64 secret token suitable for `setWebhook`.
pub fn generate_secret_token() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn doc_str_array(d: &Document, key: &str) -> Vec<String> {
    d.get_array(key)
        .ok()
        .map(|a| {
            a.iter()
                .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
//  DTOs — Subscriptions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SubscriptionRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "botUsername")]
    pub bot_username: Option<String>,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "secretToken")]
    pub secret_token: Option<String>,
    #[serde(rename = "allowedUpdates")]
    pub allowed_updates: Vec<String>,
    #[serde(rename = "maxConnections")]
    pub max_connections: i64,
    #[serde(rename = "dropPendingUpdates")]
    pub drop_pending_updates: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "ipAddress")]
    pub ip_address: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastSetAt"
    )]
    pub last_set_at: Option<DateTime<Utc>>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "lastTelegramErrorMessage"
    )]
    pub last_telegram_error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "pendingUpdateCount")]
    pub pending_update_count: Option<i64>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

fn doc_to_subscription(d: &Document, bot_username: Option<String>) -> Option<SubscriptionRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let bot_id = d.get_object_id("botId").ok()?.to_hex();
    let url = d.get_str("url").unwrap_or("").to_owned();
    let secret_token = d.get_str("secretToken").ok().map(str::to_owned);
    let allowed_updates = doc_str_array(d, "allowedUpdates");
    let max_connections = d
        .get_i64("maxConnections")
        .or_else(|_| d.get_i32("maxConnections").map(i64::from))
        .unwrap_or(40);
    let drop_pending_updates = d.get_bool("dropPendingUpdates").unwrap_or(false);
    let ip_address = d.get_str("ipAddress").ok().map(str::to_owned);
    let last_set_at = dt(d.get_datetime("lastSetAt").ok().copied());
    let last_telegram_error_message = d
        .get_str("lastTelegramErrorMessage")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let pending_update_count = d
        .get_i64("pendingUpdateCount")
        .or_else(|_| d.get_i32("pendingUpdateCount").map(i64::from))
        .ok();

    Some(SubscriptionRow {
        _id,
        project_id,
        bot_id,
        bot_username,
        url,
        secret_token,
        allowed_updates,
        max_connections,
        drop_pending_updates,
        ip_address,
        last_set_at,
        last_telegram_error_message,
        pending_update_count,
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt_or_now(d.get_datetime("updatedAt").ok().copied()),
    })
}

// ---------------------------------------------------------------------------
//  DTOs — Deliveries
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "receivedAt"
    )]
    pub received_at: DateTime<Utc>,
    #[serde(rename = "updateId")]
    pub update_id: i64,
    #[serde(rename = "eventType")]
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUserId")]
    pub from_user_id: Option<String>,
    pub status: String,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "processingDurationMs"
    )]
    pub processing_duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replayedFrom")]
    pub replayed_from: Option<String>,
}

fn doc_to_delivery(d: &Document, with_payload: bool) -> Option<DeliveryRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let bot_id = d.get_object_id("botId").ok()?.to_hex();
    let received_at = dt_or_now(d.get_datetime("receivedAt").ok().copied());
    let update_id = d
        .get_i64("updateId")
        .or_else(|_| d.get_i32("updateId").map(i64::from))
        .unwrap_or(-1);
    let event_type = d.get_str("eventType").unwrap_or("unknown").to_owned();
    let chat_id = d
        .get_str("chatId")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            d.get_i64("chatId")
                .ok()
                .map(|n| n.to_string())
                .or_else(|| d.get_i32("chatId").ok().map(|n| n.to_string()))
        });
    let from_user_id = d
        .get_str("fromUserId")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            d.get_i64("fromUserId")
                .ok()
                .map(|n| n.to_string())
                .or_else(|| d.get_i32("fromUserId").ok().map(|n| n.to_string()))
        });
    let status = d.get_str("status").unwrap_or("received").to_owned();
    let processing_duration_ms = d
        .get_i64("processingDurationMs")
        .or_else(|_| d.get_i32("processingDurationMs").map(i64::from))
        .ok();
    let error_message = d
        .get_str("errorMessage")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let payload = if with_payload {
        d.get_document("payload")
            .ok()
            .and_then(|doc| bson::to_bson(doc).ok())
            .and_then(|b| serde_json::to_value(b).ok())
    } else {
        None
    };
    let replayed_from = d.get_object_id("replayedFrom").ok().map(|o| o.to_hex());

    Some(DeliveryRow {
        _id,
        project_id,
        bot_id,
        received_at,
        update_id,
        event_type,
        chat_id,
        from_user_id,
        status,
        processing_duration_ms,
        error_message,
        payload,
        replayed_from,
    })
}

// ---------------------------------------------------------------------------
//  DTOs — DLQ
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DlqRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "originalDeliveryId")]
    pub original_delivery_id: String,
    pub attempts: i64,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastError")]
    pub last_error: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "lastAttemptAt"
    )]
    pub last_attempt_at: DateTime<Utc>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
}

fn doc_to_dlq(d: &Document, with_payload: bool) -> Option<DlqRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let bot_id = d.get_object_id("botId").ok()?.to_hex();
    let original_delivery_id = d
        .get_object_id("originalDeliveryId")
        .ok()
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let attempts = d
        .get_i64("attempts")
        .or_else(|_| d.get_i32("attempts").map(i64::from))
        .unwrap_or(0);
    let last_error = d.get_str("lastError").ok().map(str::to_owned);
    let last_attempt_at = dt_or_now(d.get_datetime("lastAttemptAt").ok().copied());
    let status = d.get_str("status").unwrap_or("pending").to_owned();
    let payload = if with_payload {
        d.get_document("payload")
            .ok()
            .and_then(|doc| bson::to_bson(doc).ok())
            .and_then(|b| serde_json::to_value(b).ok())
    } else {
        None
    };
    Some(DlqRow {
        _id,
        project_id,
        bot_id,
        original_delivery_id,
        attempts,
        last_error,
        last_attempt_at,
        status,
        payload,
    })
}

// ===========================================================================
//  Subscriptions
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ListSubsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListSubsResp {
    pub subscriptions: Vec<SubscriptionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_subscriptions(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Query(q): Query<ListSubsQuery>,
) -> Json<ListSubsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListSubsResp {
                subscriptions: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListSubsResp {
                subscriptions: vec![],
                error: Some(e),
            });
        }
    };

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bot_id) = q.bot_id.as_deref() {
        if let Some(oid) = parse_oid(bot_id) {
            filter.insert("botId", oid);
        }
    }

    let cursor = match s
        .mongo
        .collection::<Document>(SUBS)
        .find(filter)
        .sort(doc! { "updatedAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListSubsResp {
                subscriptions: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();

    // Hydrate usernames in one shot
    let bot_oids: Vec<Bson> = docs
        .iter()
        .filter_map(|d| d.get_object_id("botId").ok().map(Bson::ObjectId))
        .collect();
    let mut usernames: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if !bot_oids.is_empty() {
        if let Ok(cur) = s
            .mongo
            .collection::<Document>(BOTS)
            .find(doc! { "_id": { "$in": bot_oids } })
            .await
        {
            let bots: Vec<Document> = cur.try_collect().await.unwrap_or_default();
            for b in bots {
                if let (Ok(oid), Ok(uname)) = (b.get_object_id("_id"), b.get_str("username")) {
                    usernames.insert(oid.to_hex(), uname.to_owned());
                }
            }
        }
    }

    let subscriptions = docs
        .iter()
        .filter_map(|d| {
            let bot_id_hex = d.get_object_id("botId").ok()?.to_hex();
            let uname = usernames.get(&bot_id_hex).cloned();
            doc_to_subscription(d, uname)
        })
        .collect();
    Json(ListSubsResp {
        subscriptions,
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SubResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription: Option<SubscriptionRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookInfo")]
    pub webhook_info: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_subscription(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(bot_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<SubResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SubResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SubResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot = match require_bot(&s.mongo, project_oid, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(SubResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(SubResp {
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    let username = bot.get_str("username").ok().map(str::to_owned);

    let sub = match s
        .mongo
        .collection::<Document>(SUBS)
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await
    {
        Ok(o) => o,
        Err(e) => {
            return Json(SubResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    // Refresh via Bot API getWebhookInfo whenever we have the token —
    // best-effort so a transient outage doesn't block the page.
    let mut info_json: Option<serde_json::Value> = None;
    let mut pending: Option<i64> = None;
    let mut last_err: Option<String> = None;
    if let Ok(token) = bot.get_str("token") {
        if let Ok(info) = s.bot_api.get_webhook_info(token).await {
            pending = info.pending_update_count;
            last_err = info.last_error_message.clone();
            info_json = serde_json::to_value(&info).ok();
        }
    }

    // Persist the refreshed pending/error fields if we have a sub row.
    if let Some(sub_doc) = sub.as_ref() {
        if let Ok(id) = sub_doc.get_object_id("_id") {
            let mut update = doc! { "updatedAt": bson::DateTime::now() };
            if let Some(p) = pending {
                update.insert("pendingUpdateCount", p);
            }
            if let Some(e) = last_err.as_deref() {
                update.insert("lastTelegramErrorMessage", e);
            }
            let _ = s
                .mongo
                .collection::<Document>(SUBS)
                .update_one(doc! { "_id": id }, doc! { "$set": update })
                .await;
        }
    }

    let row = sub.and_then(|d| doc_to_subscription(&d, username));
    Json(SubResp {
        subscription: row,
        webhook_info: info_json,
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct PutSubBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub url: String,
    #[serde(default, rename = "secretToken")]
    pub secret_token: Option<String>,
    #[serde(default, rename = "allowedUpdates")]
    pub allowed_updates: Option<Vec<String>>,
    #[serde(default, rename = "maxConnections")]
    pub max_connections: Option<i64>,
    #[serde(default, rename = "dropPendingUpdates")]
    pub drop_pending_updates: Option<bool>,
    #[serde(default, rename = "ipAddress")]
    pub ip_address: Option<String>,
}

pub async fn put_subscription(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(bot_id): Path<String>,
    Json(body): Json<PutSubBody>,
) -> Json<AckResult> {
    if !body.url.starts_with("https://") {
        return err("Webhook URL must be https://.");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot = match require_bot(&s.mongo, project_oid, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    let max_connections = body.max_connections.unwrap_or(40).clamp(1, 100);
    let drop_pending = body.drop_pending_updates.unwrap_or(false);
    let allowed = body
        .allowed_updates
        .clone()
        .unwrap_or_else(default_allowed_updates);
    let secret = body
        .secret_token
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(generate_secret_token);

    let params = SetWebhookParams {
        url: &body.url,
        secret_token: &secret,
        allowed_updates: &allowed,
        max_connections,
        drop_pending_updates: drop_pending,
        ip_address: body.ip_address.as_deref().filter(|s| !s.is_empty()),
    };
    if let Err(e) = s.bot_api.set_webhook(&token, &params).await {
        return err(bot_api_err_msg(e));
    }

    let now = bson::DateTime::now();
    let mut set = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "url": &body.url,
        "secretToken": &secret,
        "allowedUpdates": Bson::Array(allowed.iter().cloned().map(Bson::String).collect()),
        "maxConnections": max_connections,
        "dropPendingUpdates": drop_pending,
        "lastSetAt": now,
        "lastTelegramErrorMessage": "",
        "updatedAt": now,
    };
    if let Some(ip) = body.ip_address.as_deref().filter(|s| !s.is_empty()) {
        set.insert("ipAddress", ip);
    }

    let coll = s.mongo.collection::<Document>(SUBS);
    let res = coll
        .update_one(
            doc! { "projectId": project_oid, "botId": bot_oid },
            doc! {
                "$set": set,
                "$setOnInsert": { "createdAt": now },
            },
        )
        .upsert(true)
        .await;
    let inserted_id = match res {
        Ok(r) => r
            .upserted_id
            .as_ref()
            .and_then(|b| b.as_object_id())
            .map(|o| o.to_hex()),
        Err(e) => return err(format!("mongo: {e}")),
    };

    // Mirror writes onto the bot row so the bots dashboard stays in sync.
    let _ = s
        .mongo
        .collection::<Document>(BOTS)
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "webhookSecret": &secret,
                    "webhookUrl": &body.url,
                    "webhookRegisteredAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await;

    Json(AckResult {
        success: true,
        subscription_id: inserted_id,
        message: Some("Webhook subscription saved.".to_owned()),
        ..Default::default()
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteSubBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "dropPendingUpdates")]
    pub drop_pending_updates: Option<bool>,
}

pub async fn delete_subscription(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(bot_id): Path<String>,
    Json(body): Json<DeleteSubBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot = match require_bot(&s.mongo, project_oid, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let drop = body.drop_pending_updates.unwrap_or(false);

    if let Ok(token) = bot.get_str("token") {
        // best-effort: ignore failures so an already-revoked token still cleans up locally
        let _ = s.bot_api.delete_webhook(token, drop).await;
    }

    let _ = s
        .mongo
        .collection::<Document>(SUBS)
        .delete_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await;

    Json(AckResult {
        success: true,
        message: Some("Webhook subscription deleted.".to_owned()),
        ..Default::default()
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct TestResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookInfo")]
    pub webhook_info: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn test_subscription(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(bot_id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<TestResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TestResp {
                success: false,
                error: Some(e),
                webhook_info: None,
            });
        }
    };
    let bot = match require_bot(&s.mongo, project_oid, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(TestResp {
                success: false,
                error: Some(e),
                webhook_info: None,
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(TestResp {
                success: false,
                error: Some("Bot is missing its access token.".to_owned()),
                webhook_info: None,
            });
        }
    };
    match s.bot_api.get_webhook_info(&token).await {
        Ok(info) => Json(TestResp {
            success: true,
            error: None,
            webhook_info: serde_json::to_value(info).ok(),
        }),
        Err(e) => Json(TestResp {
            success: false,
            error: Some(bot_api_err_msg(e)),
            webhook_info: None,
        }),
    }
}

pub async fn rotate_secret(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(bot_id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot = match require_bot(&s.mongo, project_oid, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    let sub = s
        .mongo
        .collection::<Document>(SUBS)
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await
        .ok()
        .flatten();
    let Some(sub) = sub else {
        return err("Subscription not configured. Save URL + allowed updates first.");
    };

    let url = sub.get_str("url").unwrap_or("").to_owned();
    if url.is_empty() {
        return err("Subscription has no URL.");
    }
    let allowed = doc_str_array(&sub, "allowedUpdates");
    let max_connections = sub
        .get_i64("maxConnections")
        .or_else(|_| sub.get_i32("maxConnections").map(i64::from))
        .unwrap_or(40);
    let drop_pending = sub.get_bool("dropPendingUpdates").unwrap_or(false);
    let ip_address = sub
        .get_str("ipAddress")
        .ok()
        .map(str::to_owned)
        .filter(|s| !s.is_empty());

    let new_secret = generate_secret_token();
    let params = SetWebhookParams {
        url: &url,
        secret_token: &new_secret,
        allowed_updates: &allowed,
        max_connections,
        drop_pending_updates: drop_pending,
        ip_address: ip_address.as_deref(),
    };
    if let Err(e) = s.bot_api.set_webhook(&token, &params).await {
        return err(bot_api_err_msg(e));
    }
    let now = bson::DateTime::now();
    let _ = s
        .mongo
        .collection::<Document>(SUBS)
        .update_one(
            doc! { "projectId": project_oid, "botId": bot_oid },
            doc! {
                "$set": {
                    "secretToken": &new_secret,
                    "lastSetAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await;
    // mirror onto the bot row
    let _ = s
        .mongo
        .collection::<Document>(BOTS)
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "webhookSecret": &new_secret,
                    "webhookRegisteredAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Secret token rotated.".to_owned()),
        ..Default::default()
    })
}

fn default_allowed_updates() -> Vec<String> {
    [
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "business_connection",
        "business_message",
        "edited_business_message",
        "deleted_business_messages",
        "message_reaction",
        "message_reaction_count",
        "inline_query",
        "chosen_inline_result",
        "callback_query",
        "shipping_query",
        "pre_checkout_query",
        "purchased_paid_media",
        "poll",
        "poll_answer",
        "my_chat_member",
        "chat_member",
        "chat_join_request",
        "chat_boost",
        "removed_chat_boost",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

// ===========================================================================
//  Deliveries
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ListDeliveriesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default, rename = "eventType")]
    pub event_type: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListDeliveriesResp {
    pub deliveries: Vec<DeliveryRow>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_deliveries(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Query(q): Query<ListDeliveriesQuery>,
) -> Json<ListDeliveriesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListDeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListDeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bot_id) = q.bot_id.as_deref() {
        if let Some(oid) = parse_oid(bot_id) {
            filter.insert("botId", oid);
        }
    }
    if let Some(ev) = q
        .event_type
        .as_deref()
        .filter(|s| !s.is_empty() && *s != "all")
    {
        filter.insert("eventType", ev);
    }
    if let Some(st) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", st);
    }
    if let Some(search) = q.search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert(
            "$or",
            vec![
                doc! { "chatId": { "$regex": regex_escape(search), "$options": "i" } },
                doc! { "fromUserId": { "$regex": regex_escape(search), "$options": "i" } },
            ],
        );
    }
    let mut range = doc! {};
    if let Some(from) = q.from.as_deref().and_then(parse_iso) {
        range.insert("$gte", bson::DateTime::from_millis(from.timestamp_millis()));
    }
    if let Some(to) = q.to.as_deref().and_then(parse_iso) {
        range.insert("$lte", bson::DateTime::from_millis(to.timestamp_millis()));
    }
    if !range.is_empty() {
        filter.insert("receivedAt", range);
    }
    if let Some(cur) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": cur });
    }

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
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
            return Json(ListDeliveriesResp {
                deliveries: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    let next_cursor = if docs.len() as i64 == limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    } else {
        None
    };
    let deliveries = docs
        .iter()
        .filter_map(|d| doc_to_delivery(d, false))
        .collect();
    Json(ListDeliveriesResp {
        deliveries,
        next_cursor,
        error: None,
    })
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' | '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$'
            | '/' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct GetDeliveryResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delivery: Option<DeliveryRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_delivery(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<GetDeliveryResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(GetDeliveryResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(GetDeliveryResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(GetDeliveryResp {
                error: Some("Invalid delivery id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let d = match s
        .mongo
        .collection::<Document>(DELIVERIES)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(GetDeliveryResp {
                error: Some("Delivery not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(GetDeliveryResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    Json(GetDeliveryResp {
        delivery: doc_to_delivery(&d, true),
        error: None,
    })
}

pub async fn replay_delivery(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err("Invalid delivery id."),
    };
    let deliveries = s.mongo.collection::<Document>(DELIVERIES);
    let original = match deliveries
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Delivery not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let bot_oid = match original.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Delivery is missing botId."),
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(b)) => b,
        _ => return err("Bot not found."),
    };
    let secret = bot.get_str("webhookSecret").unwrap_or("").to_owned();

    let payload_doc = match original.get_document("payload") {
        Ok(d) => d.clone(),
        Err(_) => return err("Delivery has no stored payload."),
    };
    let payload_json: serde_json::Value = match bson::to_bson(&payload_doc)
        .ok()
        .and_then(|b| serde_json::to_value(b).ok())
    {
        Some(v) => v,
        None => return err("Stored payload is not JSON-encodable."),
    };

    // Build receiver URL — prefer the configured app_url, fall back to
    // localhost so the dev loop works.
    let origin = if s.app_url.is_empty() {
        "http://localhost:3000".to_owned()
    } else {
        s.app_url.trim_end_matches('/').to_owned()
    };
    let target = format!("{origin}/api/telegram/webhook/{}", bot_oid.to_hex());

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .ok();
    let Some(http) = http else {
        return err("Failed to build HTTP client.");
    };

    let mut req = http
        .post(&target)
        .header("content-type", "application/json")
        .json(&payload_json);
    if !secret.is_empty() {
        req = req.header("x-telegram-bot-api-secret-token", secret);
    }
    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return err(format!("replay transport: {e}")),
    };
    let status = resp.status();
    if !status.is_success() {
        return err(format!("replay failed: HTTP {}", status.as_u16()));
    }

    // Insert a new delivery row that records the replay.
    let now = bson::DateTime::now();
    let event_type = original
        .get_str("eventType")
        .unwrap_or("unknown")
        .to_owned();
    let update_id = original
        .get_i64("updateId")
        .or_else(|_| original.get_i32("updateId").map(i64::from))
        .unwrap_or(-1);
    let mut new_doc = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "receivedAt": now,
        "updateId": update_id,
        "eventType": event_type,
        "status": "received",
        "payload": payload_doc,
        "replayedFrom": oid,
    };
    if let Ok(ci) = original.get_str("chatId") {
        new_doc.insert("chatId", ci);
    }
    if let Ok(fu) = original.get_str("fromUserId") {
        new_doc.insert("fromUserId", fu);
    }
    let new_id = match deliveries.insert_one(new_doc).await {
        Ok(r) => r.inserted_id.as_object_id().map(|o| o.to_hex()),
        Err(e) => return err(format!("mongo: {e}")),
    };

    Json(AckResult {
        success: true,
        message: Some("Delivery replayed.".to_owned()),
        delivery_id: new_id,
        ..Default::default()
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteDeliveriesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DeleteDeliveriesResp {
    pub success: bool,
    pub deleted: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn delete_deliveries(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Query(q): Query<DeleteDeliveriesQuery>,
) -> Json<DeleteDeliveriesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DeleteDeliveriesResp {
                success: false,
                deleted: 0,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(DeleteDeliveriesResp {
                success: false,
                deleted: 0,
                error: Some(e),
            });
        }
    };
    let before = q.before.as_deref().and_then(parse_iso);
    let n = match purge_old(&s.mongo, project_oid, before).await {
        Ok(n) => n,
        Err(e) => {
            return Json(DeleteDeliveriesResp {
                success: false,
                deleted: 0,
                error: Some(e),
            });
        }
    };
    Json(DeleteDeliveriesResp {
        success: true,
        deleted: n,
        error: None,
    })
}

/// Public — purge deliveries older than `before` (or all of the
/// project's deliveries if `before` is None). Exposed for the retention
/// worker.
pub async fn purge_old(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    before: Option<DateTime<Utc>>,
) -> Result<i64, String> {
    let mut filter = doc! { "projectId": project_oid };
    if let Some(b) = before {
        filter.insert(
            "receivedAt",
            doc! { "$lt": bson::DateTime::from_millis(b.timestamp_millis()) },
        );
    }
    let res = mongo
        .collection::<Document>(DELIVERIES)
        .delete_many(filter)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    Ok(res.deleted_count as i64)
}

// ---------------------------------------------------------------------------
//  Internal log_delivery
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct LogDeliveryBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "updateId")]
    pub update_id: i64,
    #[serde(rename = "eventType")]
    pub event_type: String,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default, rename = "fromUserId")]
    pub from_user_id: Option<String>,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "processingDurationMs")]
    pub processing_duration_ms: Option<i64>,
    #[serde(default, rename = "errorMessage")]
    pub error_message: Option<String>,
}

pub async fn log_delivery_route(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Json(body): Json<LogDeliveryBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot_oid = match parse_oid(&body.bot_id) {
        Some(o) => o,
        None => return err("invalid bot id"),
    };
    match log_delivery(
        &s.mongo,
        project_oid,
        bot_oid,
        body.update_id,
        &body.event_type,
        body.chat_id.as_deref(),
        body.from_user_id.as_deref(),
        &body.payload,
        body.status.as_deref().unwrap_or("received"),
        body.processing_duration_ms,
        body.error_message.as_deref(),
    )
    .await
    {
        Ok(id) => Json(AckResult {
            success: true,
            delivery_id: Some(id),
            ..Default::default()
        }),
        Err(e) => err(e),
    }
}

/// Public — append a delivery row. Exposed so the Next.js receiver (and
/// future Rust-side consumers) can record every incoming Telegram
/// update without HTTP overhead.
#[allow(clippy::too_many_arguments)]
pub async fn log_delivery(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    update_id: i64,
    event_type: &str,
    chat_id: Option<&str>,
    from_user_id: Option<&str>,
    payload: &serde_json::Value,
    status: &str,
    processing_duration_ms: Option<i64>,
    error_message: Option<&str>,
) -> Result<String, String> {
    let now = bson::DateTime::now();
    let payload_bson = bson::to_bson(payload).map_err(|e| format!("payload encode: {e}"))?;
    let payload_doc = match payload_bson {
        Bson::Document(d) => d,
        // Wrap non-object payloads so the schema is uniform.
        other => doc! { "value": other },
    };
    let mut entry = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "receivedAt": now,
        "updateId": update_id,
        "eventType": event_type,
        "status": status,
        "payload": payload_doc,
    };
    if let Some(c) = chat_id {
        entry.insert("chatId", c);
    }
    if let Some(f) = from_user_id {
        entry.insert("fromUserId", f);
    }
    if let Some(ms) = processing_duration_ms {
        entry.insert("processingDurationMs", ms);
    }
    if let Some(e) = error_message {
        entry.insert("errorMessage", e);
    }
    let res = mongo
        .collection::<Document>(DELIVERIES)
        .insert_one(entry)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    Ok(res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default())
}

// ===========================================================================
//  DLQ
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ListDlqQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListDlqResp {
    pub items: Vec<DlqRow>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_dlq(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Query(q): Query<ListDlqQuery>,
) -> Json<ListDlqResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListDlqResp {
                items: vec![],
                next_cursor: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListDlqResp {
                items: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bot_id) = q.bot_id.as_deref() {
        if let Some(oid) = parse_oid(bot_id) {
            filter.insert("botId", oid);
        }
    }
    if let Some(st) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", st);
    }
    if let Some(cur) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": cur });
    }

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let cursor = match s
        .mongo
        .collection::<Document>(DLQ)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListDlqResp {
                items: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    let next_cursor = if docs.len() as i64 == limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    } else {
        None
    };
    let items = docs.iter().filter_map(|d| doc_to_dlq(d, false)).collect();
    Json(ListDlqResp {
        items,
        next_cursor,
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct EnqueueDlqBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "originalDeliveryId")]
    pub original_delivery_id: String,
    #[serde(default, rename = "errorMessage")]
    pub error_message: Option<String>,
    pub payload: serde_json::Value,
}

pub async fn enqueue_dlq_route(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Json(body): Json<EnqueueDlqBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot_oid = match parse_oid(&body.bot_id) {
        Some(o) => o,
        None => return err("invalid bot id"),
    };
    let delivery_oid = match parse_oid(&body.original_delivery_id) {
        Some(o) => o,
        None => return err("invalid delivery id"),
    };
    match enqueue_dlq(
        &s.mongo,
        project_oid,
        bot_oid,
        delivery_oid,
        body.error_message.as_deref(),
        &body.payload,
    )
    .await
    {
        Ok(id) => Json(AckResult {
            success: true,
            dlq_id: Some(id),
            ..Default::default()
        }),
        Err(e) => err(e),
    }
}

pub async fn enqueue_dlq(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    original_delivery_id: ObjectId,
    error_message: Option<&str>,
    payload: &serde_json::Value,
) -> Result<String, String> {
    let now = bson::DateTime::now();
    let payload_bson = bson::to_bson(payload).map_err(|e| format!("payload encode: {e}"))?;
    let payload_doc = match payload_bson {
        Bson::Document(d) => d,
        other => doc! { "value": other },
    };
    let mut entry = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "originalDeliveryId": original_delivery_id,
        "attempts": 1_i64,
        "lastAttemptAt": now,
        "status": "pending",
        "payload": payload_doc,
        "createdAt": now,
    };
    if let Some(e) = error_message {
        entry.insert("lastError", e);
    }
    let res = mongo
        .collection::<Document>(DLQ)
        .insert_one(entry)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    Ok(res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default())
}

pub async fn retry_dlq(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err("invalid dlq id"),
    };
    let dlq = s.mongo.collection::<Document>(DLQ);
    let item = match dlq
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("DLQ item not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let bot_oid = match item.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("DLQ item missing botId."),
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(b)) => b,
        _ => return err("Bot not found."),
    };
    let secret = bot.get_str("webhookSecret").unwrap_or("").to_owned();

    let payload_doc = match item.get_document("payload") {
        Ok(d) => d.clone(),
        Err(_) => return err("DLQ item has no payload."),
    };
    let payload_json: serde_json::Value = match bson::to_bson(&payload_doc)
        .ok()
        .and_then(|b| serde_json::to_value(b).ok())
    {
        Some(v) => v,
        None => return err("Stored payload is not JSON-encodable."),
    };

    let origin = if s.app_url.is_empty() {
        "http://localhost:3000".to_owned()
    } else {
        s.app_url.trim_end_matches('/').to_owned()
    };
    let target = format!("{origin}/api/telegram/webhook/{}", bot_oid.to_hex());

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build();
    let http = match http {
        Ok(c) => c,
        Err(e) => return err(format!("http builder: {e}")),
    };
    let mut req = http
        .post(&target)
        .header("content-type", "application/json")
        .json(&payload_json);
    if !secret.is_empty() {
        req = req.header("x-telegram-bot-api-secret-token", secret);
    }

    let now = bson::DateTime::now();
    match req.send().await {
        Ok(r) if r.status().is_success() => {
            let _ = dlq
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": { "status": "resolved", "lastAttemptAt": now },
                        "$inc": { "attempts": 1_i64 },
                    },
                )
                .await;
            Json(AckResult {
                success: true,
                message: Some("Retry succeeded.".to_owned()),
                dlq_id: Some(id),
                ..Default::default()
            })
        }
        Ok(r) => {
            let status = r.status().as_u16();
            let _ = dlq
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": {
                            "status": "retrying",
                            "lastAttemptAt": now,
                            "lastError": format!("retry HTTP {status}"),
                        },
                        "$inc": { "attempts": 1_i64 },
                    },
                )
                .await;
            err(format!("retry returned HTTP {status}"))
        }
        Err(e) => {
            let msg = format!("retry transport: {e}");
            let _ = dlq
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": {
                            "status": "retrying",
                            "lastAttemptAt": now,
                            "lastError": &msg,
                        },
                        "$inc": { "attempts": 1_i64 },
                    },
                )
                .await;
            err(msg)
        }
    }
}

pub async fn resolve_dlq(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err("invalid dlq id"),
    };
    let res = s
        .mongo
        .collection::<Document>(DLQ)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! {
                "$set": {
                    "status": "resolved",
                    "lastAttemptAt": bson::DateTime::now(),
                }
            },
        )
        .await;
    match res {
        Ok(r) if r.matched_count == 0 => err("DLQ item not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Marked resolved.".to_owned()),
            dlq_id: Some(id),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn delete_dlq(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err("invalid dlq id"),
    };
    let res = s
        .mongo
        .collection::<Document>(DLQ)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await;
    match res {
        Ok(r) if r.deleted_count == 0 => err("DLQ item not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("DLQ item deleted.".to_owned()),
            dlq_id: Some(id),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ===========================================================================
//  Analytics
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ByDayPoint {
    pub date: String,
    pub received: i64,
    pub processed: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ByEventTypePoint {
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    #[serde(rename = "totalReceived")]
    pub total_received: i64,
    #[serde(rename = "totalProcessed")]
    pub total_processed: i64,
    #[serde(rename = "totalFailed")]
    pub total_failed: i64,
    #[serde(rename = "dlqCount")]
    pub dlq_count: i64,
    #[serde(rename = "avgProcessingMs")]
    pub avg_processing_ms: f64,
    #[serde(rename = "byEventType")]
    pub by_event_type: Vec<ByEventTypePoint>,
    #[serde(rename = "byDay")]
    pub by_day: Vec<ByDayPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramWebhooksState>,
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

    let now = Utc::now();
    let from = q
        .from
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or_else(|| now - Duration::days(7));
    let to = q.to.as_deref().and_then(parse_iso).unwrap_or(now);

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bot_id) = q.bot_id.as_deref() {
        if let Some(oid) = parse_oid(bot_id) {
            filter.insert("botId", oid);
        }
    }
    filter.insert(
        "receivedAt",
        doc! {
            "$gte": bson::DateTime::from_millis(from.timestamp_millis()),
            "$lte": bson::DateTime::from_millis(to.timestamp_millis()),
        },
    );

    let cursor = match s
        .mongo
        .collection::<Document>(DELIVERIES)
        .find(filter.clone())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();

    let mut total_received: i64 = 0;
    let mut total_processed: i64 = 0;
    let mut total_failed: i64 = 0;
    let mut sum_ms: i64 = 0;
    let mut ms_count: i64 = 0;
    use std::collections::BTreeMap;
    let mut by_day: BTreeMap<String, (i64, i64, i64)> = BTreeMap::new();
    let mut by_event: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    // Seed the day series so the chart has zero-filled buckets.
    let mut day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while day <= end_day && guard < 366 {
        by_day.insert(day.format("%Y-%m-%d").to_string(), (0, 0, 0));
        match day.succ_opt() {
            Some(next) => day = next,
            None => break,
        }
        guard += 1;
    }

    for d in &docs {
        let received_at = dt_or_now(d.get_datetime("receivedAt").ok().copied());
        let key = format!(
            "{:04}-{:02}-{:02}",
            received_at.year(),
            received_at.month(),
            received_at.day()
        );
        let entry = by_day.entry(key).or_insert((0, 0, 0));
        entry.0 += 1;
        total_received += 1;

        let status = d.get_str("status").unwrap_or("received");
        if status == "processed" {
            entry.1 += 1;
            total_processed += 1;
        } else if status == "failed" {
            entry.2 += 1;
            total_failed += 1;
        }

        let ev = d.get_str("eventType").unwrap_or("unknown").to_owned();
        *by_event.entry(ev).or_insert(0) += 1;

        if let Ok(ms) = d
            .get_i64("processingDurationMs")
            .or_else(|_| d.get_i32("processingDurationMs").map(i64::from))
        {
            sum_ms += ms;
            ms_count += 1;
        }
    }

    let avg_processing_ms = if ms_count > 0 {
        sum_ms as f64 / ms_count as f64
    } else {
        0.0
    };

    let dlq_filter = doc! { "projectId": project_oid };
    let dlq_count = s
        .mongo
        .collection::<Document>(DLQ)
        .count_documents(dlq_filter)
        .await
        .unwrap_or(0) as i64;

    let by_day_v = by_day
        .into_iter()
        .map(|(date, (r, p, f))| ByDayPoint {
            date,
            received: r,
            processed: p,
            failed: f,
        })
        .collect();
    let mut by_event_v: Vec<ByEventTypePoint> = by_event
        .into_iter()
        .map(|(event_type, count)| ByEventTypePoint { event_type, count })
        .collect();
    by_event_v.sort_by(|a, b| b.count.cmp(&a.count));

    Json(AnalyticsResp {
        total_received,
        total_processed,
        total_failed,
        dlq_count,
        avg_processing_ms,
        by_event_type: by_event_v,
        by_day: by_day_v,
        error: None,
    })
}
