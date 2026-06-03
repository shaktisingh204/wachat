//! HTTP handlers for Telegram Mini Apps.
//!
//! Collections:
//!   * `telegram_mini_apps`         — the registry rows.
//!   * `telegram_mini_app_sessions` — append-only log of validated
//!     `initData` opens (one row per `validate-init-data` success).
//!   * `telegram_bots`              — read-only, for resolving the bot
//!     token + username when we need to talk to Telegram.
//!
//! Every endpoint goes through [`require_project`] before any work so
//! we never leak rows across tenants.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, TimeZone, Utc};
use futures::TryStreamExt;
use hmac::{Hmac, Mac};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::collections::HashMap;
use subtle::ConstantTimeEq;

use crate::state::TelegramMiniAppsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const APPS: &str = "telegram_mini_apps";
const SESSIONS: &str = "telegram_mini_app_sessions";

type HmacSha256 = Hmac<Sha256>;

// =========================================================================
//  DTOs
// =========================================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ThemeParams {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bg_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub button_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub button_text_color: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MiniAppRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "botUsername", skip_serializing_if = "Option::is_none")]
    pub bot_username: Option<String>,
    pub name: String,
    pub slug: String,
    #[serde(rename = "webAppUrl")]
    pub web_app_url: String,
    #[serde(rename = "shortName", skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "photoUrl", skip_serializing_if = "Option::is_none")]
    pub photo_url: Option<String>,
    #[serde(rename = "themeParams")]
    pub theme_params: ThemeParams,
    #[serde(rename = "defaultButtonLabel")]
    pub default_button_label: String,
    #[serde(rename = "allowedDomains")]
    pub allowed_domains: Vec<String>,
    pub status: String,
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

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "appId")]
    pub app_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    #[serde(rename = "miniApps")]
    pub mini_apps: Vec<MiniAppRow>,
    pub total: i64,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub slug: String,
    #[serde(rename = "webAppUrl")]
    pub web_app_url: String,
    #[serde(default, rename = "shortName")]
    pub short_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(default, rename = "themeParams")]
    pub theme_params: Option<ThemeParams>,
    #[serde(default, rename = "defaultButtonLabel")]
    pub default_button_label: Option<String>,
    #[serde(default, rename = "allowedDomains")]
    pub allowed_domains: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(default)]
    pub label: Option<String>,
    /// `inline` (inline_keyboard `web_app`), `keyboard` (reply keyboard `web_app`),
    /// or `web_app_button` (alias for inline). Defaults to `inline`.
    #[serde(default, rename = "replyMarkup")]
    pub reply_markup: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SendResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "messageId")]
    pub message_id: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetMenuButtonBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    /// Optional override; if absent we use the app's `botId`.
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    /// Optional — scopes the menu button to a single chat. Telegram
    /// uses the bot-wide default when omitted.
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateInitDataBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "appId")]
    pub app_id: String,
    #[serde(rename = "initData")]
    pub init_data: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ValidateInitDataResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "authDate")]
    pub auth_date: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "queryId")]
    pub query_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SessionsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionRow {
    pub _id: String,
    #[serde(rename = "chatId", skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<i64>,
    #[serde(rename = "userId", skip_serializing_if = "Option::is_none")]
    pub user_id: Option<i64>,
    #[serde(rename = "username", skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(rename = "firstName", skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "validatedAt"
    )]
    pub validated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SessionsResp {
    pub sessions: Vec<SessionRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsDayPoint {
    pub date: String,
    pub opens: i64,
    #[serde(rename = "uniqueUsers")]
    pub unique_users: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    pub opens: i64,
    #[serde(rename = "uniqueUsers")]
    pub unique_users: i64,
    pub conversion: f64,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsDayPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// =========================================================================
//  Helpers
// =========================================================================

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
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
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
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

async fn require_app(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    app_id: &str,
) -> Result<Document, String> {
    let app_oid = parse_oid(app_id).ok_or_else(|| "Invalid mini app id.".to_owned())?;
    let app = mongo
        .collection::<Document>(APPS)
        .find_one(doc! { "_id": app_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Mini app not found.".to_owned())?;
    Ok(app)
}

async fn require_bot_in_project(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_id: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id).ok_or_else(|| "Invalid bot id.".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    Ok(bot)
}

/// `#RRGGBB`, case-insensitive. Telegram accepts only 6-digit hex for
/// theme params.
fn is_hex_color(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 7 && b[0] == b'#' && b[1..].iter().all(|c| c.is_ascii_hexdigit())
}

fn validate_theme(t: &ThemeParams) -> Result<(), String> {
    let fields: [(&str, &Option<String>); 6] = [
        ("bg_color", &t.bg_color),
        ("text_color", &t.text_color),
        ("hint_color", &t.hint_color),
        ("link_color", &t.link_color),
        ("button_color", &t.button_color),
        ("button_text_color", &t.button_text_color),
    ];
    for (name, v) in fields {
        if let Some(v) = v {
            if !v.is_empty() && !is_hex_color(v) {
                return Err(format!("themeParams.{name}: expected #RRGGBB"));
            }
        }
    }
    Ok(())
}

/// `[a-z0-9_]+` — Telegram requires the direct-link short name to be
/// lowercase letters / digits / underscores.
fn is_valid_slug(s: &str) -> bool {
    !s.is_empty()
        && s.bytes()
            .all(|c| matches!(c, b'a'..=b'z' | b'0'..=b'9' | b'_'))
}

fn is_valid_url(s: &str) -> bool {
    s.starts_with("https://") || s.starts_with("http://")
}

fn theme_to_doc(t: &ThemeParams) -> Document {
    let mut d = Document::new();
    if let Some(v) = &t.bg_color {
        d.insert("bg_color", v);
    }
    if let Some(v) = &t.text_color {
        d.insert("text_color", v);
    }
    if let Some(v) = &t.hint_color {
        d.insert("hint_color", v);
    }
    if let Some(v) = &t.link_color {
        d.insert("link_color", v);
    }
    if let Some(v) = &t.button_color {
        d.insert("button_color", v);
    }
    if let Some(v) = &t.button_text_color {
        d.insert("button_text_color", v);
    }
    d
}

fn theme_from_doc(d: &Document) -> ThemeParams {
    ThemeParams {
        bg_color: d.get_str("bg_color").ok().map(str::to_owned),
        text_color: d.get_str("text_color").ok().map(str::to_owned),
        hint_color: d.get_str("hint_color").ok().map(str::to_owned),
        link_color: d.get_str("link_color").ok().map(str::to_owned),
        button_color: d.get_str("button_color").ok().map(str::to_owned),
        button_text_color: d.get_str("button_text_color").ok().map(str::to_owned),
    }
}

fn doc_to_row(d: &Document) -> Option<MiniAppRow> {
    let theme = d
        .get_document("themeParams")
        .ok()
        .map(theme_from_doc)
        .unwrap_or_default();
    let allowed_domains = d
        .get_array("allowedDomains")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Some(MiniAppRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        bot_username: d.get_str("botUsername").ok().map(str::to_owned),
        name: d.get_str("name").unwrap_or("").to_owned(),
        slug: d.get_str("slug").unwrap_or("").to_owned(),
        web_app_url: d.get_str("webAppUrl").unwrap_or("").to_owned(),
        short_name: d.get_str("shortName").ok().map(str::to_owned),
        description: d.get_str("description").ok().map(str::to_owned),
        photo_url: d.get_str("photoUrl").ok().map(str::to_owned),
        theme_params: theme,
        default_button_label: d.get_str("defaultButtonLabel").unwrap_or("Open").to_owned(),
        allowed_domains,
        status: d.get_str("status").unwrap_or("active").to_owned(),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

// =========================================================================
//  GET /v1/telegram/mini-apps
// =========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bid) = q.bot_id.as_deref().filter(|s| !s.is_empty()) {
        if let Some(oid) = parse_oid(bid) {
            filter.insert("botId", oid);
        }
    }
    if let Some(st) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", st);
    }
    if let Some(search) = q.search.as_deref().filter(|s| !s.is_empty()) {
        let re = bson::Regex {
            pattern: regex_escape(search),
            options: "i".to_owned(),
        };
        filter.insert(
            "$or",
            vec![
                doc! { "name": &re },
                doc! { "slug": &re },
                doc! { "webAppUrl": &re },
            ],
        );
    }

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let skip = (page - 1) * page_size;

    let coll = s.mongo.collection::<Document>(APPS);
    let total = coll.count_documents(filter.clone()).await.unwrap_or(0) as i64;

    let cursor = match coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let mini_apps = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp {
        mini_apps,
        total,
        page,
        page_size,
        error: None,
    })
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(
            c,
            '.' | '+' | '*' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '^' | '$' | '|' | '\\'
        ) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

// =========================================================================
//  GET /v1/telegram/mini-apps/{app_id}
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app: Option<MiniAppRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_one(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<DetailResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DetailResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(DetailResp {
                error: Some(e),
                app: None,
            });
        }
    };
    let app = match require_app(&s.mongo, project_oid, &app_id).await {
        Ok(a) => a,
        Err(e) => {
            return Json(DetailResp {
                error: Some(e),
                app: None,
            });
        }
    };
    Json(DetailResp {
        app: doc_to_row(&app),
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/mini-apps  (create)
// =========================================================================

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    if body.name.trim().is_empty() {
        return err_ack("name is required");
    }
    if !is_valid_slug(&body.slug) {
        return err_ack("slug must match [a-z0-9_]+");
    }
    if !is_valid_url(&body.web_app_url) {
        return err_ack("webAppUrl must be a valid http(s) URL");
    }
    let theme = body.theme_params.clone().unwrap_or_default();
    if let Err(e) = validate_theme(&theme) {
        return err_ack(e);
    }
    let bot = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot is missing _id."),
    };
    let bot_username = bot.get_str("username").unwrap_or("").to_owned();

    let coll = s.mongo.collection::<Document>(APPS);
    // Slug must be unique within (projectId, botId).
    if coll
        .find_one(doc! {
            "projectId": project_oid,
            "botId": bot_oid,
            "slug": body.slug.as_str(),
        })
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return err_ack("Another mini app already uses this slug for this bot.");
    }

    let now = bson::DateTime::now();
    let mut d = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "botUsername": bot_username,
        "name": body.name.trim(),
        "slug": body.slug.as_str(),
        "webAppUrl": body.web_app_url.as_str(),
        "themeParams": theme_to_doc(&theme),
        "allowedDomains": body
            .allowed_domains
            .clone()
            .unwrap_or_default(),
        "defaultButtonLabel": body
            .default_button_label
            .clone()
            .unwrap_or_else(|| "Open".to_owned()),
        "status": body.status.clone().unwrap_or_else(|| "active".to_owned()),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(v) = body.short_name.as_deref() {
        d.insert("shortName", v);
    }
    if let Some(v) = body.description.as_deref() {
        d.insert("description", v);
    }
    if let Some(v) = body.photo_url.as_deref() {
        d.insert("photoUrl", v);
    }

    match coll.insert_one(d).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                app_id: Some(id),
                message: Some("Mini app created.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  PUT /v1/telegram/mini-apps/{app_id}  (update)
// =========================================================================

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let _existing = match require_app(&s.mongo, project_oid, &app_id).await {
        Ok(a) => a,
        Err(e) => return err_ack(e),
    };
    if body.name.trim().is_empty() {
        return err_ack("name is required");
    }
    if !is_valid_slug(&body.slug) {
        return err_ack("slug must match [a-z0-9_]+");
    }
    if !is_valid_url(&body.web_app_url) {
        return err_ack("webAppUrl must be a valid http(s) URL");
    }
    let theme = body.theme_params.clone().unwrap_or_default();
    if let Err(e) = validate_theme(&theme) {
        return err_ack(e);
    }
    let bot = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot is missing _id."),
    };
    let bot_username = bot.get_str("username").unwrap_or("").to_owned();
    let app_oid = match parse_oid(&app_id) {
        Some(o) => o,
        None => return err_ack("Invalid mini app id."),
    };

    // Slug uniqueness within (projectId, botId), excluding self.
    let coll = s.mongo.collection::<Document>(APPS);
    if coll
        .find_one(doc! {
            "_id": { "$ne": app_oid },
            "projectId": project_oid,
            "botId": bot_oid,
            "slug": body.slug.as_str(),
        })
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return err_ack("Another mini app already uses this slug for this bot.");
    }

    let now = bson::DateTime::now();
    let mut set = doc! {
        "botId": bot_oid,
        "botUsername": bot_username,
        "name": body.name.trim(),
        "slug": body.slug.as_str(),
        "webAppUrl": body.web_app_url.as_str(),
        "themeParams": theme_to_doc(&theme),
        "allowedDomains": body.allowed_domains.clone().unwrap_or_default(),
        "defaultButtonLabel": body
            .default_button_label
            .clone()
            .unwrap_or_else(|| "Open".to_owned()),
        "status": body.status.clone().unwrap_or_else(|| "active".to_owned()),
        "updatedAt": now,
    };
    let mut unset = Document::new();
    match body.short_name.as_deref() {
        Some(v) if !v.is_empty() => {
            set.insert("shortName", v);
        }
        _ => {
            unset.insert("shortName", "");
        }
    }
    match body.description.as_deref() {
        Some(v) if !v.is_empty() => {
            set.insert("description", v);
        }
        _ => {
            unset.insert("description", "");
        }
    }
    match body.photo_url.as_deref() {
        Some(v) if !v.is_empty() => {
            set.insert("photoUrl", v);
        }
        _ => {
            unset.insert("photoUrl", "");
        }
    }

    let mut update_doc = doc! { "$set": set };
    if !unset.is_empty() {
        update_doc.insert("$unset", unset);
    }

    match coll
        .update_one(
            doc! { "_id": app_oid, "projectId": project_oid },
            update_doc,
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err_ack("Mini app not found."),
        Ok(_) => Json(AckResult {
            success: true,
            app_id: Some(app_id),
            message: Some("Mini app updated.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  DELETE /v1/telegram/mini-apps/{app_id}
// =========================================================================

pub async fn delete_one(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&app_id) {
        Some(o) => o,
        None => return err_ack("Invalid mini app id."),
    };
    match s
        .mongo
        .collection::<Document>(APPS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err_ack("Mini app not found."),
        Ok(_) => Json(AckResult {
            success: true,
            app_id: Some(app_id),
            message: Some("Mini app deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  POST /v1/telegram/mini-apps/{app_id}/send
// =========================================================================

pub async fn send_to_chat(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Json(body): Json<SendBody>,
) -> Json<SendResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SendResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    if body.chat_id.trim().is_empty() {
        return Json(SendResp {
            success: false,
            error: Some("chatId is required".to_owned()),
            ..Default::default()
        });
    }
    let app = match require_app(&s.mongo, project_oid, &app_id).await {
        Ok(a) => a,
        Err(e) => {
            return Json(SendResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match app.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => {
            return Json(SendResp {
                success: false,
                error: Some("Mini app is missing botId".to_owned()),
                ..Default::default()
            });
        }
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(b)) => b,
        _ => {
            return Json(SendResp {
                success: false,
                error: Some("Bot not found".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) if !t.is_empty() => t.to_owned(),
        _ => {
            return Json(SendResp {
                success: false,
                error: Some("Bot is missing token".to_owned()),
                ..Default::default()
            });
        }
    };

    let web_app_url = app.get_str("webAppUrl").unwrap_or("").to_owned();
    let default_label = app
        .get_str("defaultButtonLabel")
        .unwrap_or("Open")
        .to_owned();
    let app_name = app.get_str("name").unwrap_or("Mini App").to_owned();
    let label = body.label.clone().unwrap_or(default_label);
    let style = body
        .reply_markup
        .clone()
        .unwrap_or_else(|| "inline".to_owned());
    let text = body
        .text
        .clone()
        .unwrap_or_else(|| format!("Open {app_name}"));

    // Build reply_markup based on style.
    let reply_markup = match style.as_str() {
        "keyboard" => json!({
            "keyboard": [[ { "text": label, "web_app": { "url": web_app_url } } ]],
            "resize_keyboard": true,
            "one_time_keyboard": false,
        }),
        // "inline" and "web_app_button" both produce an inline_keyboard.
        _ => json!({
            "inline_keyboard": [[ { "text": label, "web_app": { "url": web_app_url } } ]],
        }),
    };

    // We can't extend SendMessageParams to carry reply_markup without
    // touching telegram-bots, so build the JSON body inline.
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    let body_json = json!({
        "chat_id": body.chat_id,
        "text": text,
        "reply_markup": reply_markup,
    });
    let http = reqwest::Client::new();
    let resp = match http.post(&url).json(&body_json).send().await {
        Ok(r) => r,
        Err(e) => {
            return Json(SendResp {
                success: false,
                error: Some(format!("telegram: {e}")),
                ..Default::default()
            });
        }
    };
    let env: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            return Json(SendResp {
                success: false,
                error: Some(format!("telegram: {e}")),
                ..Default::default()
            });
        }
    };
    if env.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let desc = env
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("telegram error")
            .to_owned();
        return Json(SendResp {
            success: false,
            error: Some(desc),
            ..Default::default()
        });
    }
    let message_id = env
        .get("result")
        .and_then(|r| r.get("message_id"))
        .and_then(|v| v.as_i64());
    Json(SendResp {
        success: true,
        message_id,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/mini-apps/{app_id}/set-menu-button
// =========================================================================

pub async fn set_menu_button(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Json(body): Json<SetMenuButtonBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let app = match require_app(&s.mongo, project_oid, &app_id).await {
        Ok(a) => a,
        Err(e) => return err_ack(e),
    };
    // Resolve bot — override or app's bot.
    let bot_oid = if let Some(bid) = body.bot_id.as_deref().filter(|s| !s.is_empty()) {
        match parse_oid(bid) {
            Some(o) => o,
            None => return err_ack("Invalid bot id."),
        }
    } else {
        match app.get_object_id("botId") {
            Ok(o) => o,
            Err(_) => return err_ack("Mini app is missing botId."),
        }
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(b)) => b,
        _ => return err_ack("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) if !t.is_empty() => t.to_owned(),
        _ => return err_ack("Bot is missing token."),
    };
    let label = app
        .get_str("defaultButtonLabel")
        .unwrap_or("Open")
        .to_owned();
    let web_app_url = app.get_str("webAppUrl").unwrap_or("").to_owned();

    let menu_button = json!({
        "type": "web_app",
        "text": label,
        "web_app": { "url": web_app_url },
    });

    // Telegram supports `chat_id` on setChatMenuButton to scope the
    // button per chat; the wrapper doesn't expose that, so we call the
    // HTTP endpoint directly with the extra param.
    let url = format!("https://api.telegram.org/bot{token}/setChatMenuButton");
    let mut payload = json!({ "menu_button": menu_button });
    if let Some(chat) = body.chat_id {
        payload["chat_id"] = json!(chat);
    }
    let http = reqwest::Client::new();
    let resp = match http.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => return err_ack(format!("telegram: {e}")),
    };
    let env: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => return err_ack(format!("telegram: {e}")),
    };
    if env.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let desc = env
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("telegram error")
            .to_owned();
        return err_ack(desc);
    }
    Json(AckResult {
        success: true,
        app_id: Some(app_id),
        message: Some("Menu button set.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/mini-apps/validate-init-data
// =========================================================================

/// Verify the WebApp `initData` payload Telegram passes to the mini
/// app. Spec:
/// 1. URL-decode every `key=value` pair, exclude `hash`.
/// 2. Sort the remaining pairs by key and join with `\n` →
///    `dataCheckString`.
/// 3. `secret_key = HMAC_SHA256("WebAppData", bot_token)`.
/// 4. `expected = HMAC_SHA256(secret_key, dataCheckString)`.
/// 5. Compare `expected` to the hex-decoded `hash` in constant time.
pub async fn validate_init_data(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Json(body): Json<ValidateInitDataBody>,
) -> Json<ValidateInitDataResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let app = match require_app(&s.mongo, project_oid, &body.app_id).await {
        Ok(a) => a,
        Err(e) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match app.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("Mini app is missing botId".to_owned()),
                ..Default::default()
            });
        }
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(b)) => b,
        _ => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("Bot not found".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) if !t.is_empty() => t.to_owned(),
        _ => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("Bot is missing token".to_owned()),
                ..Default::default()
            });
        }
    };

    // 1. Parse query-string-style pairs.
    let mut pairs: Vec<(String, String)> = Vec::new();
    let mut hash_hex: Option<String> = None;
    for piece in body.init_data.split('&') {
        if piece.is_empty() {
            continue;
        }
        let (k, v) = match piece.split_once('=') {
            Some((k, v)) => (k, v),
            None => (piece, ""),
        };
        let k_dec = match urlencoding::decode(k) {
            Ok(c) => c.into_owned(),
            Err(_) => k.to_owned(),
        };
        let v_dec = match urlencoding::decode(v) {
            Ok(c) => c.into_owned(),
            Err(_) => v.to_owned(),
        };
        if k_dec == "hash" {
            hash_hex = Some(v_dec);
        } else {
            pairs.push((k_dec, v_dec));
        }
    }
    let hash_hex = match hash_hex {
        Some(h) if !h.is_empty() => h,
        _ => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("initData is missing hash".to_owned()),
                ..Default::default()
            });
        }
    };
    pairs.sort_by(|a, b| a.0.cmp(&b.0));
    let data_check_string = pairs
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("\n");

    // 2. secret_key = HMAC_SHA256("WebAppData", bot_token).
    let mut mac = match HmacSha256::new_from_slice(b"WebAppData") {
        Ok(m) => m,
        Err(_) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("hmac init failed".to_owned()),
                ..Default::default()
            });
        }
    };
    mac.update(token.as_bytes());
    let secret_key = mac.finalize().into_bytes();

    // 3. expected = HMAC_SHA256(secret_key, dataCheckString).
    let mut mac2 = match HmacSha256::new_from_slice(&secret_key) {
        Ok(m) => m,
        Err(_) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("hmac init failed".to_owned()),
                ..Default::default()
            });
        }
    };
    mac2.update(data_check_string.as_bytes());
    let expected = mac2.finalize().into_bytes();
    let received = match hex::decode(&hash_hex) {
        Ok(v) => v,
        Err(_) => {
            return Json(ValidateInitDataResp {
                success: false,
                error: Some("hash is not valid hex".to_owned()),
                ..Default::default()
            });
        }
    };
    if expected.len() != received.len() {
        return Json(ValidateInitDataResp {
            success: false,
            error: Some("Signature does not match.".to_owned()),
            ..Default::default()
        });
    }
    let eq: bool = expected.as_slice().ct_eq(received.as_slice()).into();
    if !eq {
        return Json(ValidateInitDataResp {
            success: false,
            error: Some("Signature does not match.".to_owned()),
            ..Default::default()
        });
    }

    // 4. Extract user + auth_date + query_id.
    let mut map: HashMap<&str, &str> = HashMap::new();
    for (k, v) in &pairs {
        map.insert(k.as_str(), v.as_str());
    }
    let user_json: Option<serde_json::Value> =
        map.get("user").and_then(|s| serde_json::from_str(s).ok());
    let auth_date = map.get("auth_date").and_then(|s| s.parse::<i64>().ok());
    let query_id = map.get("query_id").map(|s| s.to_string());

    // 5. Log a session row (best-effort; failures don't block validation).
    let now = bson::DateTime::now();
    let app_oid = app.get_object_id("_id").ok();
    if let Some(app_oid) = app_oid {
        let mut session = doc! {
            "projectId": project_oid,
            "appId": app_oid,
            "botId": bot_oid,
            "validatedAt": now,
        };
        if let Some(u) = &user_json {
            if let Some(id) = u.get("id").and_then(|v| v.as_i64()) {
                session.insert("userId", id);
            }
            if let Some(uname) = u.get("username").and_then(|v| v.as_str()) {
                session.insert("username", uname);
            }
            if let Some(fname) = u.get("first_name").and_then(|v| v.as_str()) {
                session.insert("firstName", fname);
            }
        }
        let _ = s
            .mongo
            .collection::<Document>(SESSIONS)
            .insert_one(session)
            .await;
    }

    Json(ValidateInitDataResp {
        success: true,
        user: user_json,
        auth_date,
        query_id,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/mini-apps/{app_id}/sessions
// =========================================================================

pub async fn list_sessions(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
    Query(q): Query<SessionsQuery>,
) -> Json<SessionsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SessionsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SessionsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let app_oid = match parse_oid(&app_id) {
        Some(o) => o,
        None => {
            return Json(SessionsResp {
                error: Some("Invalid mini app id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let mut filter = doc! { "projectId": project_oid, "appId": app_oid };
    if let Some(cursor) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        if let Some(oid) = parse_oid(cursor) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let cur = match s
        .mongo
        .collection::<Document>(SESSIONS)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(SessionsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cur.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(SessionsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let next_cursor = docs
        .last()
        .and_then(|d| d.get_object_id("_id").ok())
        .map(|o| o.to_hex());
    let sessions = docs
        .iter()
        .map(|d| SessionRow {
            _id: d
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default(),
            chat_id: d.get_i64("chatId").ok(),
            user_id: d.get_i64("userId").ok(),
            username: d.get_str("username").ok().map(str::to_owned),
            first_name: d.get_str("firstName").ok().map(str::to_owned),
            validated_at: dt(d.get_datetime("validatedAt").ok().copied()),
            country: d.get_str("country").ok().map(str::to_owned),
            device: d.get_str("device").ok().map(str::to_owned),
        })
        .collect();
    Json(SessionsResp {
        sessions,
        next_cursor,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/mini-apps/{app_id}/analytics
// =========================================================================

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Path(app_id): Path<String>,
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
    let app_oid = match parse_oid(&app_id) {
        Some(o) => o,
        None => {
            return Json(AnalyticsResp {
                error: Some("Invalid mini app id.".to_owned()),
                ..Default::default()
            });
        }
    };

    // Date window: default last 7 days.
    let now = Utc::now();
    let from = q
        .from
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or(now - Duration::days(7));
    let to =
        q.to.as_deref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or(now);
    let from_bson = bson::DateTime::from_chrono(from);
    let to_bson = bson::DateTime::from_chrono(to);

    let filter = doc! {
        "projectId": project_oid,
        "appId": app_oid,
        "validatedAt": { "$gte": from_bson, "$lte": to_bson },
    };
    let cur = match s.mongo.collection::<Document>(SESSIONS).find(filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cur.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let opens = docs.len() as i64;
    let mut user_ids: std::collections::HashSet<i64> = std::collections::HashSet::new();
    let mut per_day: std::collections::BTreeMap<String, (i64, std::collections::HashSet<i64>)> =
        Default::default();
    for d in &docs {
        let ts = dt(d.get_datetime("validatedAt").ok().copied());
        let day = ts.format("%Y-%m-%d").to_string();
        let entry = per_day
            .entry(day)
            .or_insert((0, std::collections::HashSet::new()));
        entry.0 += 1;
        if let Ok(uid) = d.get_i64("userId") {
            user_ids.insert(uid);
            entry.1.insert(uid);
        }
    }
    let unique_users = user_ids.len() as i64;
    // Conversion currently = unique_users / opens (best proxy until we
    // track button-click impressions separately). Falls back to 0 when
    // opens is zero.
    let conversion = if opens > 0 {
        unique_users as f64 / opens as f64
    } else {
        0.0
    };
    let by_day = per_day
        .into_iter()
        .map(|(date, (cnt, set))| AnalyticsDayPoint {
            date,
            opens: cnt,
            unique_users: set.len() as i64,
        })
        .collect();
    Json(AnalyticsResp {
        opens,
        unique_users,
        conversion,
        by_day,
        error: None,
    })
}
