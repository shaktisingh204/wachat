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
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use rand::RngCore;
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use std::sync::OnceLock;
use std::time::Instant;

use crate::bot_api::{BotApiError, ChatAdministratorRights, SetWebhookParams};
use crate::dto::{
    AckResult, AdminRightsDto, AdminRightsQuery, AdminRightsResp, BotCommandDto, BotInfoResp,
    BotRow, BulkDisconnectBody, BulkDisconnectResp, CommandsResp, ConnectBotBody,
    DeleteCommandsQuery, ExportQuery, GetBotResp, GetCommandsQuery, HealthResp, ListBotsQuery,
    ListBotsResp, MenuButtonResp, SetAdminRightsBody, SetCommandsBody, SetDescriptionBody,
    SetMenuButtonBody, SetNameBody, SetShortDescriptionBody, WebhookInfoView,
};
use crate::state::TelegramBotsState;

const PROJECTS_COLLECTION: &str = "projects";
const BOTS_COLLECTION: &str = "telegram_bots";

const ALLOWED_UPDATES: &[&str] = &[
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
    let webhook_info = d.get_document("webhookInfo").ok().map(|w| WebhookInfoView {
        url: w.get_str("url").ok().map(str::to_owned),
        pending_update_count: w.get_i64("pendingUpdateCount").ok(),
        last_error_message: w.get_str("lastErrorMessage").ok().map(str::to_owned),
        last_error_date: w
            .get_datetime("lastErrorDate")
            .ok()
            .map(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
            .flatten(),
        max_connections: w.get_i64("maxConnections").ok(),
        ip_address: w.get_str("ipAddress").ok().map(str::to_owned),
        allowed_updates: w.get_array("allowedUpdates").ok().map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        }),
        has_custom_certificate: w.get_bool("hasCustomCertificate").ok(),
    });

    let can_join_groups = d.get_bool("canJoinGroups").ok();
    let can_read_all_group_messages = d.get_bool("canReadAllGroupMessages").ok();
    let supports_inline_queries = d.get_bool("supportsInlineQueries").ok();
    let has_main_web_app = d.get_bool("hasMainWebApp").ok();

    let last_seen_at = d
        .get_datetime("lastSeenAt")
        .ok()
        .and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single());
    let latency_ms = d.get_i64("latencyMs").ok();

    let has_webhook_error = webhook_info
        .as_ref()
        .map(|w| w.last_error_message.is_some())
        .unwrap_or(false);
    let status = if !is_active {
        "disconnected".to_owned()
    } else if has_webhook_error {
        "error".to_owned()
    } else {
        "active".to_owned()
    };

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
        has_main_web_app,
        status,
        last_seen_at,
        latency_ms,
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
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(50).clamp(1, 200);

    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListBotsResp {
                bots: vec![],
                total: 0,
                page,
                page_size,
                error: Some("projectId is required".to_owned()),
            });
        }
    };

    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                total: 0,
                page,
                page_size,
                error: Some(e),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(BOTS_COLLECTION);

    let mut filter = doc! { "projectId": project_oid };
    if let Some(qs) = q.q.as_deref().filter(|s| !s.is_empty()) {
        let safe = regex::escape(qs);
        let rx = bson::Regex {
            pattern: safe,
            options: "i".to_owned(),
        };
        filter.insert(
            "$or",
            bson::Bson::Array(vec![
                bson::Bson::Document(doc! { "name": Bson::RegularExpression(rx.clone()) }),
                bson::Bson::Document(doc! { "username": Bson::RegularExpression(rx) }),
            ]),
        );
    }
    match q.status.as_deref() {
        Some("disconnected") => {
            filter.insert("isActive", false);
        }
        Some("active") => {
            filter.insert("isActive", true);
            filter.insert("webhookInfo.lastErrorMessage", doc! { "$exists": false });
        }
        Some("error") => {
            filter.insert("isActive", true);
            filter.insert("webhookInfo.lastErrorMessage", doc! { "$exists": true });
        }
        _ => {}
    }

    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                total: 0,
                page,
                page_size,
                error: Some(format!("mongo: {e}")),
            });
        }
    };

    let skip = ((page - 1) * page_size).max(0) as u64;
    let cursor = match coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListBotsResp {
                bots: vec![],
                total: 0,
                page,
                page_size,
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
                total: 0,
                page,
                page_size,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let bots = docs.iter().filter_map(doc_to_row).collect();
    Json(ListBotsResp {
        bots,
        total,
        page,
        page_size,
        error: None,
    })
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
    if let Some(m) = info.max_connections {
        webhook_info.insert("maxConnections", m);
    }
    if let Some(ip) = info.ip_address {
        webhook_info.insert("ipAddress", ip);
    }
    if let Some(updates) = info.allowed_updates {
        webhook_info.insert(
            "allowedUpdates",
            Bson::Array(updates.into_iter().map(Bson::String).collect()),
        );
    }
    if let Some(b) = info.has_custom_certificate {
        webhook_info.insert("hasCustomCertificate", b);
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

// =========================================================================
//  Shared helpers for self-management handlers
// =========================================================================

async fn require_bot_for_project(
    user: &AuthUser,
    s: &TelegramBotsState,
    bot_id: &str,
    project_id: &str,
) -> Result<Document, String> {
    let project_oid = require_project(user, &s.mongo, project_id).await?;
    let bot = require_bot(user, &s.mongo, bot_id).await?;
    let bot_project = bot
        .get_object_id("projectId")
        .map_err(|_| "Bot not found.".to_owned())?;
    if bot_project != project_oid {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

fn extract_token(bot: &Document) -> Result<String, String> {
    bot.get_str("token")
        .map(str::to_owned)
        .map_err(|_| "Bot is missing its access token.".to_owned())
}

// =========================================================================
//  GET /v1/telegram/bots/{bot_id}/info — getMe + persist
// =========================================================================

pub async fn get_bot_info(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<BotInfoResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(BotInfoResp {
                bot: None,
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(BotInfoResp {
                bot: None,
                error: Some("Bot not found.".to_owned()),
            });
        }
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => {
            return Json(BotInfoResp {
                bot: None,
                error: Some(e),
            });
        }
    };

    let started = Instant::now();
    let me = match s.bot_api.get_me(&token).await {
        Ok(me) => me,
        Err(e) => {
            return Json(BotInfoResp {
                bot: None,
                error: Some(err_msg(e)),
            });
        }
    };
    let latency = started.elapsed().as_millis() as i64;
    let now = bson::DateTime::now();

    let display_name = {
        let parts: Vec<&str> = [me.first_name.as_deref(), me.last_name.as_deref()]
            .into_iter()
            .flatten()
            .filter(|s| !s.is_empty())
            .collect();
        let combined = parts.join(" ");
        if combined.is_empty() {
            me.username.clone().unwrap_or_default()
        } else {
            combined
        }
    };

    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
    let mut set = doc! {
        "name": &display_name,
        "canJoinGroups": me.can_join_groups.unwrap_or(false),
        "canReadAllGroupMessages": me.can_read_all_group_messages.unwrap_or(false),
        "supportsInlineQueries": me.supports_inline_queries.unwrap_or(false),
        "hasMainWebApp": me.has_main_web_app.unwrap_or(false),
        "latencyMs": latency,
        "lastSeenAt": now,
        "updatedAt": now,
    };
    if let Some(u) = me.username.as_deref() {
        set.insert("username", u);
    }
    if let Err(e) = bots
        .update_one(doc! { "_id": bot_oid }, doc! { "$set": set })
        .await
    {
        return Json(BotInfoResp {
            bot: None,
            error: Some(format!("mongo: {e}")),
        });
    }
    let fresh = bots.find_one(doc! { "_id": bot_oid }).await.ok().flatten();
    Json(BotInfoResp {
        bot: fresh.as_ref().and_then(doc_to_row),
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/bots/{bot_id}/health
// =========================================================================

pub async fn health_check(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<HealthResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(HealthResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(HealthResp {
                success: false,
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => {
            return Json(HealthResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let started = Instant::now();
    let result = s.bot_api.get_me(&token).await;
    let latency = started.elapsed().as_millis() as i64;
    let now = Utc::now();

    match result {
        Ok(_) => {
            let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
            let _ = bots
                .update_one(
                    doc! { "_id": bot_oid },
                    doc! {
                        "$set": {
                            "latencyMs": latency,
                            "lastSeenAt": bson::DateTime::from_chrono(now),
                            "isActive": true,
                            "updatedAt": bson::DateTime::now(),
                        }
                    },
                )
                .await;
            Json(HealthResp {
                success: true,
                error: None,
                latency_ms: Some(latency),
                last_seen_at: Some(now),
            })
        }
        Err(e) => Json(HealthResp {
            success: false,
            error: Some(err_msg(e)),
            latency_ms: Some(latency),
            last_seen_at: None,
        }),
    }
}

// =========================================================================
//  Commands — GET / POST / DELETE
// =========================================================================

pub async fn get_commands(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Query(q): Query<GetCommandsQuery>,
) -> Json<CommandsResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(CommandsResp {
                commands: vec![],
                error: Some(e),
            });
        }
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => {
            return Json(CommandsResp {
                commands: vec![],
                error: Some(e),
            });
        }
    };
    match s
        .bot_api
        .get_my_commands_full(&token, None, q.language_code.as_deref())
        .await
    {
        Ok(list) => Json(CommandsResp {
            commands: list
                .into_iter()
                .map(|c| BotCommandDto {
                    command: c.command,
                    description: c.description,
                })
                .collect(),
            error: None,
        }),
        Err(e) => Json(CommandsResp {
            commands: vec![],
            error: Some(err_msg(e)),
        }),
    }
}

pub async fn set_commands(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetCommandsBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    let commands: Vec<crate::bot_api::BotCommand> = body
        .commands
        .into_iter()
        .map(|c| crate::bot_api::BotCommand {
            command: c.command,
            description: c.description,
        })
        .collect();
    if let Err(e) = s
        .bot_api
        .set_my_commands_full(
            &token,
            &commands,
            body.scope.as_ref(),
            body.language_code.as_deref(),
        )
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(Some("Commands saved.".to_owned()), Some(bot_id))
}

pub async fn delete_commands(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Query(q): Query<DeleteCommandsQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let bot = match require_bot_for_project(&user, &s, &bot_id, project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = s
        .bot_api
        .delete_my_commands(&token, None, q.language_code.as_deref())
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(Some("Commands cleared.".to_owned()), Some(bot_id))
}

// =========================================================================
//  Name / description / short description
// =========================================================================

pub async fn set_name(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetNameBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = s
        .bot_api
        .set_my_name_full(&token, Some(&body.name), body.language_code.as_deref())
        .await
    {
        return err_ack(err_msg(e));
    }
    if body.language_code.is_none() {
        if let Ok(oid) = bot.get_object_id("_id") {
            let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
            let _ = bots
                .update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "name": &body.name, "updatedAt": bson::DateTime::now() } },
                )
                .await;
        }
    }
    ok_ack(Some("Name updated.".to_owned()), Some(bot_id))
}

pub async fn set_description(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetDescriptionBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = s
        .bot_api
        .set_my_description_full(
            &token,
            Some(&body.description),
            body.language_code.as_deref(),
        )
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(Some("Description updated.".to_owned()), Some(bot_id))
}

pub async fn set_short_description(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetShortDescriptionBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = s
        .bot_api
        .set_my_short_description_full(
            &token,
            Some(&body.short_description),
            body.language_code.as_deref(),
        )
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(Some("Short description updated.".to_owned()), Some(bot_id))
}

// =========================================================================
//  Menu button — GET / POST
// =========================================================================

pub async fn get_menu_button(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
) -> Json<MenuButtonResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(MenuButtonResp {
                menu_button: None,
                error: Some(e),
            });
        }
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => {
            return Json(MenuButtonResp {
                menu_button: None,
                error: Some(e),
            });
        }
    };
    match s.bot_api.get_chat_menu_button(&token).await {
        Ok(v) => Json(MenuButtonResp {
            menu_button: Some(v),
            error: None,
        }),
        Err(e) => Json(MenuButtonResp {
            menu_button: None,
            error: Some(err_msg(e)),
        }),
    }
}

pub async fn set_menu_button(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetMenuButtonBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = s
        .bot_api
        .set_chat_menu_button(&token, &body.menu_button)
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(Some("Menu button updated.".to_owned()), Some(bot_id))
}

// =========================================================================
//  Default administrator rights — GET / POST
// =========================================================================

fn rights_to_api(r: &AdminRightsDto) -> ChatAdministratorRights {
    ChatAdministratorRights {
        is_anonymous: r.is_anonymous,
        can_manage_chat: r.can_manage_chat,
        can_delete_messages: r.can_delete_messages,
        can_manage_video_chats: r.can_manage_video_chats,
        can_restrict_members: r.can_restrict_members,
        can_promote_members: r.can_promote_members,
        can_change_info: r.can_change_info,
        can_invite_users: r.can_invite_users,
        can_post_messages: r.can_post_messages,
        can_edit_messages: r.can_edit_messages,
        can_pin_messages: r.can_pin_messages,
        can_manage_topics: r.can_manage_topics,
        can_post_stories: r.can_post_stories,
        can_edit_stories: r.can_edit_stories,
        can_delete_stories: r.can_delete_stories,
    }
}

fn rights_from_api(r: ChatAdministratorRights) -> AdminRightsDto {
    AdminRightsDto {
        is_anonymous: r.is_anonymous,
        can_manage_chat: r.can_manage_chat,
        can_delete_messages: r.can_delete_messages,
        can_manage_video_chats: r.can_manage_video_chats,
        can_restrict_members: r.can_restrict_members,
        can_promote_members: r.can_promote_members,
        can_change_info: r.can_change_info,
        can_invite_users: r.can_invite_users,
        can_post_messages: r.can_post_messages,
        can_edit_messages: r.can_edit_messages,
        can_pin_messages: r.can_pin_messages,
        can_manage_topics: r.can_manage_topics,
        can_post_stories: r.can_post_stories,
        can_edit_stories: r.can_edit_stories,
        can_delete_stories: r.can_delete_stories,
    }
}

pub async fn get_default_admin_rights(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Query(q): Query<AdminRightsQuery>,
) -> Json<AdminRightsResp> {
    let for_channels = q.for_channels.unwrap_or(false);
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(AdminRightsResp {
                rights: None,
                for_channels,
                error: Some(e),
            });
        }
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => {
            return Json(AdminRightsResp {
                rights: None,
                for_channels,
                error: Some(e),
            });
        }
    };
    match s
        .bot_api
        .get_my_default_administrator_rights(&token, for_channels)
        .await
    {
        Ok(r) => Json(AdminRightsResp {
            rights: Some(rights_from_api(r)),
            for_channels,
            error: None,
        }),
        Err(e) => Json(AdminRightsResp {
            rights: None,
            for_channels,
            error: Some(err_msg(e)),
        }),
    }
}

pub async fn set_default_admin_rights(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetAdminRightsBody>,
) -> Json<AckResult> {
    let bot = match require_bot_for_project(&user, &s, &bot_id, &body.project_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let token = match extract_token(&bot) {
        Ok(t) => t,
        Err(e) => return err_ack(e),
    };
    let api_rights = body.rights.as_ref().map(rights_to_api);
    if let Err(e) = s
        .bot_api
        .set_my_default_administrator_rights(&token, api_rights.as_ref(), body.for_channels)
        .await
    {
        return err_ack(err_msg(e));
    }
    ok_ack(
        Some("Default administrator rights updated.".to_owned()),
        Some(bot_id),
    )
}

// =========================================================================
//  POST /v1/telegram/bots/bulk-disconnect
// =========================================================================

pub async fn bulk_disconnect(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Json(body): Json<BulkDisconnectBody>,
) -> Json<BulkDisconnectResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(BulkDisconnectResp {
                success: false,
                disconnected: 0,
                failed: 0,
                error: Some(e),
            });
        }
    };
    let mut oids: Vec<ObjectId> = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        if let Some(o) = parse_oid(id) {
            oids.push(o);
        }
    }
    if oids.is_empty() {
        return Json(BulkDisconnectResp {
            success: true,
            disconnected: 0,
            failed: 0,
            error: None,
        });
    }
    let bots = s.mongo.collection::<Document>(BOTS_COLLECTION);
    use futures::TryStreamExt;
    let cursor = match bots
        .find(doc! { "_id": { "$in": &oids }, "projectId": project_oid })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(BulkDisconnectResp {
                success: false,
                disconnected: 0,
                failed: 0,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(BulkDisconnectResp {
                success: false,
                disconnected: 0,
                failed: 0,
                error: Some(format!("mongo: {e}")),
            });
        }
    };

    let mut disconnected = 0i64;
    let mut failed = 0i64;
    for d in &docs {
        let oid = match d.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => {
                failed += 1;
                continue;
            }
        };
        if let Ok(token) = d.get_str("token") {
            let _ = s.bot_api.delete_webhook(token).await;
        }
        if bots.delete_one(doc! { "_id": oid }).await.is_ok() {
            disconnected += 1;
        } else {
            failed += 1;
        }
    }
    Json(BulkDisconnectResp {
        success: failed == 0,
        disconnected,
        failed,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/bots/export?projectId=…  — CSV
// =========================================================================

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_owned()
    }
}

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramBotsState>,
    Query(q): Query<ExportQuery>,
) -> impl IntoResponse {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                HeaderMap::new(),
                "projectId is required".to_owned(),
            );
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => return (StatusCode::FORBIDDEN, HeaderMap::new(), e),
    };

    let coll = s.mongo.collection::<Document>(BOTS_COLLECTION);
    use futures::TryStreamExt;
    let cursor = match coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                format!("mongo: {e}"),
            );
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                format!("mongo: {e}"),
            );
        }
    };
    let rows: Vec<BotRow> = docs.iter().filter_map(doc_to_row).collect();

    let mut out = String::new();
    out.push_str(
        "id,bot_id,username,name,status,is_active,webhook_url,last_seen_at,latency_ms,created_at\n",
    );
    for r in &rows {
        out.push_str(&csv_escape(&r._id));
        out.push(',');
        out.push_str(&r.bot_id.to_string());
        out.push(',');
        out.push_str(&csv_escape(&r.username));
        out.push(',');
        out.push_str(&csv_escape(&r.name));
        out.push(',');
        out.push_str(&csv_escape(&r.status));
        out.push(',');
        out.push_str(if r.is_active { "true" } else { "false" });
        out.push(',');
        out.push_str(&csv_escape(r.webhook_url.as_deref().unwrap_or("")));
        out.push(',');
        out.push_str(&r.last_seen_at.map(|d| d.to_rfc3339()).unwrap_or_default());
        out.push(',');
        out.push_str(&r.latency_ms.map(|n| n.to_string()).unwrap_or_default());
        out.push(',');
        out.push_str(&r.created_at.to_rfc3339());
        out.push('\n');
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"telegram-bots.csv\""),
    );
    (StatusCode::OK, headers, out)
}
