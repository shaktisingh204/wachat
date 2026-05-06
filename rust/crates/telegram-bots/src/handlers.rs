//! HTTP handlers for the Telegram Bots slice.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/telegram.actions.ts`.
//!
//! All endpoints follow the `{ success, error?, message?, … }` envelope
//! convention used by the legacy TS actions — handlers never `?` out
//! into a 4xx body unless the caller is unauthenticated.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use rand::RngCore;
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use std::sync::OnceLock;

use crate::bot_api::{BotApiError, SetWebhookParams};
use crate::dto::{
    AckResult, BotRow, ConnectBotBody, GetBotResp, ListBotsQuery, ListBotsResp,
    WebhookInfoView,
};
use crate::state::TelegramBotsState;

const PROJECTS_COLLECTION: &str = "projects";
const BOTS_COLLECTION: &str = "telegram_bots";

const ALLOWED_UPDATES: &[&str] = &[
    "message",
    "edited_message",
    "channel_post",
    "callback_query",
    "inline_query",
    "my_chat_member",
    "business_connection",
    "business_message",
    "edited_business_message",
];

// =========================================================================
//  Helpers
// =========================================================================

fn token_format() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\d+:[A-Za-z0-9_-]{20,}$").unwrap())
}

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

fn ok_ack(message: Option<String>, bot_id: Option<String>) -> Json<AckResult> {
    Json(AckResult {
        success: true,
        error: None,
        message,
        bot_id,
    })
}

/// Confirm the caller owns the project. Returns the project's `_id` on
/// success. Mirrors the `getProjectById` helper used by the TS originals
/// — `NotFound` is conflated with "owned by another user" so we don't
/// leak project existence across tenants.
async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;

    let owner = doc.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

/// Load a bot, confirming the caller owns its project. On success
/// returns the raw Mongo doc.
async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let bot_coll = mongo.collection::<Document>(BOTS_COLLECTION);
    let bot = bot_coll
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;

    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;

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

fn new_webhook_secret() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn build_webhook_url(app_url: &str, bot_id_hex: &str) -> Option<String> {
    let trimmed = app_url.trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    let origin = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_owned()
    } else {
        format!("https://{trimmed}")
    };
    if !origin.starts_with("https://") {
        return None;
    }
    Some(format!("{origin}/api/telegram/webhook/{bot_id_hex}"))
}

fn doc_to_row(d: &Document) -> Option<BotRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let user_id = d.get_object_id("userId").ok()?.to_hex();
    let bot_id_num = d
        .get_i64("botId")
        .or_else(|_| d.get_i32("botId").map(i64::from))
        .ok()?;
    let username = d.get_str("username").unwrap_or("").to_owned();
    let name = d.get_str("name").unwrap_or("").to_owned();
    let is_active = d.get_bool("isActive").unwrap_or(true);

    let webhook_url = d.get_str("webhookUrl").ok().map(str::to_owned);
    let webhook_registered_at = d
        .get_datetime("webhookRegisteredAt")
        .ok()
        .map(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .flatten();
    let webhook_info = d
        .get_document("webhookInfo")
        .ok()
        .map(|w| WebhookInfoView {
            url: w.get_str("url").ok().map(str::to_owned),
            pending_update_count: w.get_i64("pendingUpdateCount").ok(),
            last_error_message: w.get_str("lastErrorMessage").ok().map(str::to_owned),
            last_error_date: w
                .get_datetime("lastErrorDate")
                .ok()
                .map(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
                .flatten(),
        });

    let can_join_groups = d.get_bool("canJoinGroups").ok();
    let can_read_all_group_messages = d.get_bool("canReadAllGroupMessages").ok();
    let supports_inline_queries = d.get_bool("supportsInlineQueries").ok();

    let created_at = d
        .get_datetime("createdAt")
        .ok()
        .and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now);
    let updated_at = d
        .get_datetime("updatedAt")
        .ok()
        .and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or(created_at);

    Some(BotRow {
        _id,
        project_id,
        user_id,
        bot_id: bot_id_num,
        username,
        name,
        is_active,
        webhook_url,
        webhook_registered_at,
        webhook_info,
        can_join_groups,
        can_read_all_group_messages,
        supports_inline_queries,
        created_at,
        updated_at,
    })
}

fn err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

// =========================================================================
//  GET /v1/telegram/bots?projectId=…  — listTelegramBots
// =========================================================================

pub async fn list_bots(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Query(q): Query<ListBotsQuery>,
) -> Json<ListBotsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListBotsResp {
                bots: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };

    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                error: Some(e),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(BOTS_COLLECTION);
    let cursor = match coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };

    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let bots = docs.iter().filter_map(doc_to_row).collect();
    Json(ListBotsResp { bots, error: None })
}

// =========================================================================
//  GET /v1/telegram/bots/{bot_id}  — getTelegramBot
// =========================================================================

pub async fn get_bot(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<GetBotResp> {
    match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(d) => Json(GetBotResp {
            bot: doc_to_row(&d),
            error: None,
        }),
        Err(e) => Json(GetBotResp {
            bot: None,
            error: Some(e),
        }),
    }
}

// =========================================================================
//  POST /v1/telegram/bots  — connectTelegramBot
// =========================================================================

pub async fn connect_bot(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Json(body): Json<ConnectBotBody>,
) -> Json<AckResult> {
    let token = body.token.trim();
    if !token_format().is_match(token) {
        return err_ack("Token format looks wrong. Expected 123456:AAA-token.");
    }

    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err_ack(e),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err_ack("invalid auth subject"),
    };

    let me = match s.bot_api.get_me(token).await {
        Ok(me) => me,
        Err(e) => return err_ack(err_msg(e)),
    };
    if !me.is_bot {
        return err_ack("Token does not belong to a bot.");
    }
    let username = match me.username {
        Some(u) if !u.is_empty() => u,
        _ => return err_ack("Token does not belong to a bot."),
    };

    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);

    // Cross-project duplicate guard: same numeric botId, different
    // project → reject (matches TS originals).
    if let Ok(Some(existing)) = bots.find_one(doc! { "botId": me.id }).await {
        if existing.get_object_id("projectId").ok() != Some(project_oid) {
            return err_ack("This bot is already linked to another workspace.");
        }
    }

    let now = bson::DateTime::now();
    let webhook_secret = new_webhook_secret();

    let display_name = {
        let parts: Vec<&str> = [me.first_name.as_deref(), me.last_name.as_deref()]
            .into_iter()
            .flatten()
            .filter(|s| !s.is_empty())
            .collect();
        let combined = parts.join(" ");
        if combined.is_empty() {
            username.clone()
        } else {
            combined
        }
    };

    let upsert = doc! {
        "$setOnInsert": {
            "projectId": project_oid,
            "userId": user_oid,
            "botId": me.id,
            "createdAt": now,
        },
        "$set": {
            "username": &username,
            "name": &display_name,
            "token": token,
            "webhookSecret": &webhook_secret,
            "canJoinGroups": me.can_join_groups.unwrap_or(false),
            "canReadAllGroupMessages": me.can_read_all_group_messages.unwrap_or(false),
            "supportsInlineQueries": me.supports_inline_queries.unwrap_or(false),
            "isActive": true,
            "updatedAt": now,
        },
    };

    let opts = mongodb::options::FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .build();
    let bot_doc = match bots
        .find_one_and_update(doc! { "botId": me.id }, upsert)
        .with_options(opts)
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Failed to persist bot."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };

    let bot_oid = match bot_doc.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Failed to persist bot."),
    };
    let bot_id_hex = bot_oid.to_hex();

    let webhook_url = match build_webhook_url(&s.app_url, &bot_id_hex) {
        Some(u) => u,
        None => {
            return Json(AckResult {
                success: true,
                error: None,
                message: Some(
                    "Bot saved, but NEXT_PUBLIC_APP_URL must be an https URL before the webhook can be registered."
                        .to_owned(),
                ),
                bot_id: Some(bot_id_hex),
            });
        }
    };

    if let Err(e) = s
        .bot_api
        .set_webhook(
            token,
            &SetWebhookParams {
                url: &webhook_url,
                secret_token: &webhook_secret,
                allowed_updates: ALLOWED_UPDATES,
            },
        )
        .await
    {
        return err_ack(err_msg(e));
    }

    if let Err(e) = bots
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "webhookUrl": &webhook_url,
                    "webhookRegisteredAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await
    {
        return err_ack(format!("mongo: {e}"));
    }

    ok_ack(Some(format!("Connected @{username}.")), Some(bot_id_hex))
}

// =========================================================================
//  DELETE /v1/telegram/bots/{bot_id}  — disconnectTelegramBot
// =========================================================================

pub async fn disconnect_bot(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot not found."),
    };

    // Best-effort: remove the webhook from Telegram. We deliberately
    // ignore failures so a token that was already revoked elsewhere
    // doesn't block local cleanup.
    if let Ok(token) = bot.get_str("token") {
        let _ = s.bot_api.delete_webhook(token).await;
    }

    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
    if let Err(e) = bots.delete_one(doc! { "_id": bot_oid }).await {
        return err_ack(format!("mongo: {e}"));
    }

    ok_ack(Some("Bot disconnected.".to_owned()), Some(bot_id))
}

// =========================================================================
//  POST /v1/telegram/bots/{bot_id}/webhook/refresh
//  — refreshTelegramWebhookInfo
// =========================================================================

pub async fn refresh_webhook_info(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<AckResult> {
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

    let info = match s.bot_api.get_webhook_info(&token).await {
        Ok(i) => i,
        Err(e) => return err_ack(err_msg(e)),
    };

    let mut webhook_info = doc! {};
    if let Some(u) = info.url {
        webhook_info.insert("url", u);
    }
    if let Some(p) = info.pending_update_count {
        webhook_info.insert("pendingUpdateCount", p);
    }
    if let Some(m) = info.last_error_message {
        webhook_info.insert("lastErrorMessage", m);
    }
    if let Some(ts) = info.last_error_date {
        if let Some(dt) = Utc.timestamp_opt(ts, 0).single() {
            webhook_info.insert("lastErrorDate", bson::DateTime::from_chrono(dt));
        }
    }

    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
    if let Err(e) = bots
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "webhookInfo": webhook_info,
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await
    {
        return err_ack(format!("mongo: {e}"));
    }

    ok_ack(Some("Webhook info refreshed.".to_owned()), Some(bot_id))
}

// =========================================================================
//  POST /v1/telegram/bots/{bot_id}/webhook/rotate
//  — rotateTelegramWebhookSecret
// =========================================================================

pub async fn rotate_webhook_secret(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<AckResult> {
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

    let new_secret = new_webhook_secret();
    let webhook_url = match build_webhook_url(&s.app_url, &bot_id) {
        Some(u) => u,
        None => {
            return err_ack(
                "NEXT_PUBLIC_APP_URL must be an https URL before the webhook can be rotated.",
            );
        }
    };

    if let Err(e) = s
        .bot_api
        .set_webhook(
            &token,
            &SetWebhookParams {
                url: &webhook_url,
                secret_token: &new_secret,
                allowed_updates: ALLOWED_UPDATES,
            },
        )
        .await
    {
        return err_ack(err_msg(e));
    }

    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
    if let Err(e) = bots
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "webhookSecret": new_secret,
                    "webhookUrl": &webhook_url,
                    "webhookRegisteredAt": bson::DateTime::now(),
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await
    {
        return err_ack(format!("mongo: {e}"));
    }

    ok_ack(Some("Webhook secret rotated.".to_owned()), Some(bot_id))
}
