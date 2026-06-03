//! HTTP handlers for the Telegram commands registry.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value as JsonValue, json};
use std::sync::OnceLock;
use telegram_bots::bot_api::{BotApiError, BotCommand};

use crate::state::TelegramCommandsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const DEFINITIONS: &str = "telegram_command_definitions";
const INVOCATIONS: &str = "telegram_command_invocations";

const SCOPE_DEFAULT: &str = "default";
const SCOPE_ALL_PRIVATE: &str = "all_private_chats";
const SCOPE_ALL_GROUPS: &str = "all_group_chats";
const SCOPE_ALL_CHAT_ADMINS: &str = "all_chat_administrators";
const SCOPE_CHAT: &str = "chat";
const SCOPE_CHAT_ADMINS: &str = "chat_administrators";
const SCOPE_CHAT_MEMBER: &str = "chat_member";

const VALID_SCOPES: &[&str] = &[
    SCOPE_DEFAULT,
    SCOPE_ALL_PRIVATE,
    SCOPE_ALL_GROUPS,
    SCOPE_ALL_CHAT_ADMINS,
    SCOPE_CHAT,
    SCOPE_CHAT_ADMINS,
    SCOPE_CHAT_MEMBER,
];

const HANDLER_REPLY_TEXT: &str = "reply_text";
const HANDLER_REPLY_MEDIA: &str = "reply_media";
const HANDLER_RUN_FLOW: &str = "run_flow";
const HANDLER_HTTP_CALL: &str = "http_call";
const HANDLER_NOOP: &str = "noop";

const VALID_HANDLERS: &[&str] = &[
    HANDLER_REPLY_TEXT,
    HANDLER_REPLY_MEDIA,
    HANDLER_RUN_FLOW,
    HANDLER_HTTP_CALL,
    HANDLER_NOOP,
];

// =========================================================================
//  Shared envelopes / DTOs
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "commandId")]
    pub command_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScopeDto {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "userId")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandlerDto {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<JsonValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "botId")]
    pub bot_id: Option<String>,
    pub command: String,
    pub description: String,
    pub scope: ScopeDto,
    #[serde(skip_serializing_if = "Option::is_none", rename = "languageCode")]
    pub language_code: Option<String>,
    pub handler: HandlerDto,
    pub hidden: bool,
    #[serde(rename = "runCount")]
    pub run_count: i64,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastRunAt"
    )]
    pub last_run_at: Option<DateTime<Utc>>,
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

// =========================================================================
//  Helpers
// =========================================================================

fn command_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[a-z][a-z0-9_]{0,31}$").unwrap())
}

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

fn ok_ack(message: Option<String>, command_id: Option<String>) -> Json<AckResult> {
    Json(AckResult {
        success: true,
        message,
        command_id,
        ..Default::default()
    })
}

fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn dt_opt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
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

async fn require_bot_in_project(
    mongo: &MongoHandle,
    bot_id: &str,
    project_oid: ObjectId,
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

fn scope_from_doc(d: &Document) -> ScopeDto {
    ScopeDto {
        kind: d.get_str("kind").unwrap_or(SCOPE_DEFAULT).to_owned(),
        chat_id: d.get_str("chatId").ok().map(str::to_owned),
        user_id: d.get_str("userId").ok().map(str::to_owned),
    }
}

fn handler_from_doc(d: &Document) -> HandlerDto {
    let kind = d.get_str("kind").unwrap_or(HANDLER_NOOP).to_owned();
    let payload = d
        .get("payload")
        .and_then(|b| bson::to_bson(b).ok())
        .and_then(|b| serde_json::to_value(b).ok());
    HandlerDto { kind, payload }
}

fn doc_to_row(d: &Document) -> Option<CommandRow> {
    Some(CommandRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok().map(|o| o.to_hex()),
        command: d.get_str("command").unwrap_or("").to_owned(),
        description: d.get_str("description").unwrap_or("").to_owned(),
        scope: d
            .get_document("scope")
            .ok()
            .map(scope_from_doc)
            .unwrap_or(ScopeDto {
                kind: SCOPE_DEFAULT.to_owned(),
                chat_id: None,
                user_id: None,
            }),
        language_code: d.get_str("languageCode").ok().map(str::to_owned),
        handler: d
            .get_document("handler")
            .ok()
            .map(handler_from_doc)
            .unwrap_or(HandlerDto {
                kind: HANDLER_NOOP.to_owned(),
                payload: None,
            }),
        hidden: d.get_bool("hidden").unwrap_or(false),
        run_count: d
            .get_i64("runCount")
            .or_else(|_| d.get_i32("runCount").map(i64::from))
            .unwrap_or(0),
        last_run_at: dt_opt(d.get_datetime("lastRunAt").ok().copied()),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn validate_command_name(cmd: &str) -> Result<(), String> {
    if !command_regex().is_match(cmd) {
        return Err(
            "Command must be 1-32 chars, lowercase, start with a letter, and contain only a-z, 0-9, _."
                .to_owned(),
        );
    }
    Ok(())
}

fn normalize_command(raw: &str) -> String {
    let trimmed = raw.trim().trim_start_matches('/').to_lowercase();
    trimmed
}

fn validate_scope(scope: &ScopeInput) -> Result<(), String> {
    if !VALID_SCOPES.contains(&scope.kind.as_str()) {
        return Err(format!("unknown scope kind: {}", scope.kind));
    }
    match scope.kind.as_str() {
        SCOPE_CHAT | SCOPE_CHAT_ADMINS => {
            if scope
                .chat_id
                .as_deref()
                .map(|s| s.is_empty())
                .unwrap_or(true)
            {
                return Err(format!("scope `{}` requires chatId", scope.kind));
            }
        }
        SCOPE_CHAT_MEMBER => {
            if scope
                .chat_id
                .as_deref()
                .map(|s| s.is_empty())
                .unwrap_or(true)
            {
                return Err("scope `chat_member` requires chatId".to_owned());
            }
            if scope
                .user_id
                .as_deref()
                .map(|s| s.is_empty())
                .unwrap_or(true)
            {
                return Err("scope `chat_member` requires userId".to_owned());
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_handler(handler: &HandlerInput) -> Result<(), String> {
    if !VALID_HANDLERS.contains(&handler.kind.as_str()) {
        return Err(format!("unknown handler kind: {}", handler.kind));
    }
    match handler.kind.as_str() {
        HANDLER_REPLY_TEXT => {
            let text = handler
                .payload
                .as_ref()
                .and_then(|v| v.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if text.trim().is_empty() {
                return Err("reply_text handler requires payload.text".to_owned());
            }
        }
        HANDLER_REPLY_MEDIA => {
            let url = handler
                .payload
                .as_ref()
                .and_then(|v| v.get("url"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if url.trim().is_empty() {
                return Err("reply_media handler requires payload.url".to_owned());
            }
        }
        HANDLER_RUN_FLOW => {
            let flow_id = handler
                .payload
                .as_ref()
                .and_then(|v| v.get("flowId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if flow_id.trim().is_empty() {
                return Err("run_flow handler requires payload.flowId".to_owned());
            }
        }
        HANDLER_HTTP_CALL => {
            let url = handler
                .payload
                .as_ref()
                .and_then(|v| v.get("url"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if url.trim().is_empty() {
                return Err("http_call handler requires payload.url".to_owned());
            }
        }
        _ => {}
    }
    Ok(())
}

fn scope_to_doc(scope: &ScopeInput) -> Document {
    let mut d = doc! { "kind": &scope.kind };
    if let Some(c) = scope.chat_id.as_deref().filter(|s| !s.is_empty()) {
        d.insert("chatId", c);
    }
    if let Some(u) = scope.user_id.as_deref().filter(|s| !s.is_empty()) {
        d.insert("userId", u);
    }
    d
}

fn handler_to_doc(h: &HandlerInput) -> Document {
    let mut d = doc! { "kind": &h.kind };
    if let Some(p) = &h.payload {
        if let Ok(b) = bson::to_bson(p) {
            d.insert("payload", b);
        }
    }
    d
}

fn scope_to_bot_api(scope: &ScopeDto) -> Option<JsonValue> {
    let kind = scope.kind.as_str();
    let api_type = match kind {
        SCOPE_DEFAULT => "default",
        SCOPE_ALL_PRIVATE => "all_private_chats",
        SCOPE_ALL_GROUPS => "all_group_chats",
        SCOPE_ALL_CHAT_ADMINS => "all_chat_administrators",
        SCOPE_CHAT => "chat",
        SCOPE_CHAT_ADMINS => "chat_administrators",
        SCOPE_CHAT_MEMBER => "chat_member",
        _ => return None,
    };
    let mut v = json!({ "type": api_type });
    if let Some(c) = scope.chat_id.as_deref() {
        if matches!(kind, SCOPE_CHAT | SCOPE_CHAT_ADMINS | SCOPE_CHAT_MEMBER) {
            v["chat_id"] = JsonValue::String(c.to_owned());
        }
    }
    if let Some(u) = scope.user_id.as_deref() {
        if kind == SCOPE_CHAT_MEMBER {
            if let Ok(n) = u.parse::<i64>() {
                v["user_id"] = JsonValue::Number(n.into());
            } else {
                v["user_id"] = JsonValue::String(u.to_owned());
            }
        }
    }
    Some(v)
}

fn err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

// =========================================================================
//  Inputs
// =========================================================================

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ScopeInput {
    #[serde(default = "default_scope_kind")]
    pub kind: String,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
}

fn default_scope_kind() -> String {
    SCOPE_DEFAULT.to_owned()
}

#[derive(Debug, Clone, Deserialize)]
pub struct HandlerInput {
    pub kind: String,
    #[serde(default)]
    pub payload: Option<JsonValue>,
}

impl Default for HandlerInput {
    fn default() -> Self {
        Self {
            kind: HANDLER_NOOP.to_owned(),
            payload: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    pub command: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub scope: Option<ScopeInput>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default)]
    pub handler: Option<HandlerInput>,
    #[serde(default)]
    pub hidden: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default, rename = "clearBot")]
    pub clear_bot: Option<bool>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub scope: Option<ScopeInput>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default, rename = "clearLanguageCode")]
    pub clear_language_code: Option<bool>,
    #[serde(default)]
    pub handler: Option<HandlerInput>,
    #[serde(default)]
    pub hidden: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DetailQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PushBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default)]
    pub scope: Option<ScopeInput>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MatchBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub command: String,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LogBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "commandId")]
    pub command_id: String,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
    pub success: bool,
    #[serde(default, rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub commands: Vec<CreateBody>,
    #[serde(default)]
    pub mode: Option<String>,
}

// =========================================================================
//  GET /v1/telegram/commands
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub commands: Vec<CommandRow>,
    pub total: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn empty_list(err: Option<String>, page: i64, page_size: i64) -> ListResp {
    ListResp {
        commands: vec![],
        total: 0,
        has_more: false,
        page,
        page_size,
        error: err,
    }
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(empty_list(
                Some("projectId is required".to_owned()),
                page,
                page_size,
            ));
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(empty_list(Some(e), page, page_size)),
    };

    let mut filter = doc! { "projectId": project_oid };
    if let Some(b) = q.bot_id.as_deref().filter(|s| !s.is_empty()) {
        if b == "any" || b == "all" {
            // no-op, includes both project-wide (null) and per-bot
        } else if b == "none" || b == "project" {
            filter.insert("botId", Bson::Null);
        } else if let Some(oid) = parse_oid(b) {
            filter.insert("botId", oid);
        }
    }
    if let Some(scope) = q.scope.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("scope.kind", scope);
    }
    if let Some(lc) = q.language_code.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("languageCode", lc);
    }
    if let Some(search) = q.search.as_deref() {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let escaped = regex::escape(trimmed);
            let rx = bson::Regex {
                pattern: escaped,
                options: "i".to_owned(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "command": Bson::RegularExpression(rx.clone()) },
                    doc! { "description": Bson::RegularExpression(rx) },
                ],
            );
        }
    }

    let coll = s.mongo.collection::<Document>(DEFINITIONS);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")), page, page_size)),
    };
    let skip = ((page - 1) * page_size).max(0) as u64;
    let cursor = match coll
        .find(filter)
        .sort(doc! { "command": 1, "createdAt": -1 })
        .skip(skip)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")), page, page_size)),
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")), page, page_size)),
    };
    let commands: Vec<CommandRow> = docs.iter().filter_map(doc_to_row).collect();
    let has_more = skip + (commands.len() as i64 as u64) < total as u64;
    Json(ListResp {
        commands,
        total,
        has_more,
        page,
        page_size,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/commands
// =========================================================================

async fn ensure_no_duplicate(
    coll: &mongodb::Collection<Document>,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
    command: &str,
    scope_kind: &str,
    scope_chat: Option<&str>,
    scope_user: Option<&str>,
    language_code: Option<&str>,
    exclude_id: Option<ObjectId>,
) -> Result<(), String> {
    let mut filter = doc! {
        "projectId": project_oid,
        "command": command,
        "scope.kind": scope_kind,
    };
    match bot_oid {
        Some(b) => {
            filter.insert("botId", b);
        }
        None => {
            filter.insert("botId", Bson::Null);
        }
    }
    if let Some(c) = scope_chat {
        filter.insert("scope.chatId", c);
    } else {
        filter.insert("scope.chatId", doc! { "$exists": false });
    }
    if let Some(u) = scope_user {
        filter.insert("scope.userId", u);
    } else {
        filter.insert("scope.userId", doc! { "$exists": false });
    }
    if let Some(lc) = language_code {
        filter.insert("languageCode", lc);
    } else {
        filter.insert("languageCode", doc! { "$exists": false });
    }
    if let Some(eid) = exclude_id {
        filter.insert("_id", doc! { "$ne": eid });
    }
    match coll.find_one(filter).await {
        Ok(Some(_)) => Err(
            "A command with the same name, scope and language already exists in this project."
                .to_owned(),
        ),
        Ok(None) => Ok(()),
        Err(e) => Err(format!("mongo: {e}")),
    }
}

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let cmd = normalize_command(&body.command);
    if let Err(e) = validate_command_name(&cmd) {
        return err_ack(e);
    }
    let description = body.description.unwrap_or_default();
    if description.chars().count() > 256 {
        return err_ack("Description must be 256 characters or fewer.");
    }
    let scope = body.scope.unwrap_or_default();
    if let Err(e) = validate_scope(&scope) {
        return err_ack(e);
    }
    let handler = body.handler.unwrap_or_default();
    if let Err(e) = validate_handler(&handler) {
        return err_ack(e);
    }
    let bot_oid = match body.bot_id.as_deref().filter(|b| !b.is_empty()) {
        Some(b) => match parse_oid(b) {
            Some(o) => {
                if let Err(e) = require_bot_in_project(&s.mongo, b, project_oid).await {
                    return err_ack(e);
                }
                Some(o)
            }
            None => return err_ack("invalid bot id"),
        },
        None => None,
    };

    let coll = s.mongo.collection::<Document>(DEFINITIONS);
    if let Err(e) = ensure_no_duplicate(
        &coll,
        project_oid,
        bot_oid,
        &cmd,
        &scope.kind,
        scope.chat_id.as_deref(),
        scope.user_id.as_deref(),
        body.language_code.as_deref(),
        None,
    )
    .await
    {
        return err_ack(e);
    }

    let now = bson::DateTime::now();
    let mut doc_to_insert = doc! {
        "projectId": project_oid,
        "command": &cmd,
        "description": &description,
        "scope": scope_to_doc(&scope),
        "handler": handler_to_doc(&handler),
        "hidden": body.hidden.unwrap_or(false),
        "runCount": 0i64,
        "createdAt": now,
        "updatedAt": now,
    };
    match bot_oid {
        Some(b) => {
            doc_to_insert.insert("botId", b);
        }
        None => {
            doc_to_insert.insert("botId", Bson::Null);
        }
    }
    if let Some(lc) = body.language_code.as_deref().filter(|s| !s.is_empty()) {
        doc_to_insert.insert("languageCode", lc);
    }

    match coll.insert_one(doc_to_insert).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            ok_ack(Some("Command created.".to_owned()), Some(id))
        }
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  GET /v1/telegram/commands/{id}
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<CommandRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn detail(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(id): Path<String>,
    Query(q): Query<DetailQuery>,
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
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("invalid id".to_owned()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(DEFINITIONS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => Json(DetailResp {
            command: doc_to_row(&d),
            error: None,
        }),
        Ok(None) => Json(DetailResp {
            error: Some("Command not found.".to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(DetailResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  PUT /v1/telegram/commands/{id}
// =========================================================================

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err_ack("invalid id"),
    };
    let coll = s.mongo.collection::<Document>(DEFINITIONS);
    let existing = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Command not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };

    let existing_row = match doc_to_row(&existing) {
        Some(r) => r,
        None => return err_ack("Command is malformed."),
    };

    let next_command = match body.command.as_deref() {
        Some(c) => {
            let n = normalize_command(c);
            if let Err(e) = validate_command_name(&n) {
                return err_ack(e);
            }
            n
        }
        None => existing_row.command.clone(),
    };
    let next_description = body
        .description
        .as_deref()
        .map(str::to_owned)
        .unwrap_or(existing_row.description.clone());
    if next_description.chars().count() > 256 {
        return err_ack("Description must be 256 characters or fewer.");
    }
    let next_scope = match body.scope {
        Some(s) => s,
        None => ScopeInput {
            kind: existing_row.scope.kind.clone(),
            chat_id: existing_row.scope.chat_id.clone(),
            user_id: existing_row.scope.user_id.clone(),
        },
    };
    if let Err(e) = validate_scope(&next_scope) {
        return err_ack(e);
    }
    let next_handler = match body.handler {
        Some(h) => h,
        None => HandlerInput {
            kind: existing_row.handler.kind.clone(),
            payload: existing_row.handler.payload.clone(),
        },
    };
    if let Err(e) = validate_handler(&next_handler) {
        return err_ack(e);
    }

    let clear_bot = body.clear_bot.unwrap_or(false);
    let next_bot_oid: Option<ObjectId> = if clear_bot {
        None
    } else if let Some(b) = body.bot_id.as_deref().filter(|b| !b.is_empty()) {
        match parse_oid(b) {
            Some(o) => {
                if let Err(e) = require_bot_in_project(&s.mongo, b, project_oid).await {
                    return err_ack(e);
                }
                Some(o)
            }
            None => return err_ack("invalid bot id"),
        }
    } else {
        existing.get_object_id("botId").ok()
    };

    let clear_lc = body.clear_language_code.unwrap_or(false);
    let next_language: Option<String> = if clear_lc {
        None
    } else if let Some(lc) = body.language_code.as_deref().filter(|s| !s.is_empty()) {
        Some(lc.to_owned())
    } else {
        existing_row.language_code.clone()
    };

    if let Err(e) = ensure_no_duplicate(
        &coll,
        project_oid,
        next_bot_oid,
        &next_command,
        &next_scope.kind,
        next_scope.chat_id.as_deref(),
        next_scope.user_id.as_deref(),
        next_language.as_deref(),
        Some(oid),
    )
    .await
    {
        return err_ack(e);
    }

    let now = bson::DateTime::now();
    let mut set = doc! {
        "command": &next_command,
        "description": &next_description,
        "scope": scope_to_doc(&next_scope),
        "handler": handler_to_doc(&next_handler),
        "hidden": body.hidden.unwrap_or(existing_row.hidden),
        "updatedAt": now,
    };
    match next_bot_oid {
        Some(b) => {
            set.insert("botId", b);
        }
        None => {
            set.insert("botId", Bson::Null);
        }
    }
    let mut unset = doc! {};
    match next_language.as_deref() {
        Some(lc) => {
            set.insert("languageCode", lc);
        }
        None => {
            unset.insert("languageCode", "");
        }
    }

    let mut update_doc = doc! { "$set": set };
    if !unset.is_empty() {
        update_doc.insert("$unset", unset);
    }

    match coll
        .update_one(doc! { "_id": oid, "projectId": project_oid }, update_doc)
        .await
    {
        Ok(r) if r.matched_count == 0 => err_ack("Command not found."),
        Ok(_) => ok_ack(Some("Command updated.".to_owned()), Some(id)),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  DELETE /v1/telegram/commands/{id}
// =========================================================================

pub async fn delete_one(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(id): Path<String>,
    Query(q): Query<DetailQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err_ack("invalid id"),
    };
    match s
        .mongo
        .collection::<Document>(DEFINITIONS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err_ack("Command not found."),
        Ok(_) => ok_ack(Some("Command deleted.".to_owned()), Some(id)),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  POST /v1/telegram/commands/{id}/duplicate
// =========================================================================

pub async fn duplicate(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(id): Path<String>,
    Json(body): Json<DetailQuery>,
) -> Json<AckResult> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err_ack("invalid id"),
    };
    let coll = s.mongo.collection::<Document>(DEFINITIONS);
    let existing = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Command not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };

    let row = match doc_to_row(&existing) {
        Some(r) => r,
        None => return err_ack("Command is malformed."),
    };
    let base = row.command.clone();
    let mut candidate = format!("{base}_copy");
    if candidate.chars().count() > 32 {
        candidate.truncate(32);
    }
    let mut suffix = 2;
    while !command_regex().is_match(&candidate) || {
        let f = doc! {
            "projectId": project_oid,
            "command": &candidate,
        };
        coll.count_documents(f).await.unwrap_or(0) > 0
    } {
        candidate = format!("{base}_copy{suffix}");
        if candidate.chars().count() > 32 {
            candidate.truncate(32);
        }
        suffix += 1;
        if suffix > 50 {
            return err_ack("Could not find a free command name.");
        }
    }

    let now = bson::DateTime::now();
    let mut new_doc = existing.clone();
    new_doc.remove("_id");
    new_doc.insert("command", &candidate);
    new_doc.insert("runCount", 0i64);
    new_doc.remove("lastRunAt");
    new_doc.insert("createdAt", now);
    new_doc.insert("updatedAt", now);

    match coll.insert_one(new_doc).await {
        Ok(res) => {
            let new_id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            ok_ack(Some(format!("Duplicated as /{candidate}.")), Some(new_id))
        }
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// =========================================================================
//  POST /v1/telegram/commands/push
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct PushResp {
    pub success: bool,
    pub pushed: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

fn collect_for_push(rows: &[CommandRow]) -> Vec<BotCommand> {
    rows.iter()
        .filter(|r| !r.hidden)
        .map(|r| BotCommand {
            command: r.command.clone(),
            description: if r.description.is_empty() {
                r.command.clone()
            } else {
                r.description.clone()
            },
        })
        .collect()
}

async fn fetch_commands_for_push(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    scope_kind: &str,
    scope_chat: Option<&str>,
    scope_user: Option<&str>,
    language_code: Option<&str>,
) -> Result<Vec<CommandRow>, String> {
    let mut filter = doc! {
        "projectId": project_oid,
        "scope.kind": scope_kind,
        "$or": vec![
            doc! { "botId": bot_oid },
            doc! { "botId": Bson::Null },
        ],
    };
    if let Some(c) = scope_chat {
        filter.insert("scope.chatId", c);
    }
    if let Some(u) = scope_user {
        filter.insert("scope.userId", u);
    }
    if let Some(lc) = language_code {
        filter.insert("languageCode", lc);
    } else {
        filter.insert("languageCode", doc! { "$exists": false });
    }
    let coll = mongo.collection::<Document>(DEFINITIONS);
    let cursor = coll
        .find(filter)
        .sort(doc! { "command": 1 })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    Ok(docs.iter().filter_map(doc_to_row).collect())
}

pub async fn push(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<PushBody>,
) -> Json<PushResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(PushResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot = match require_bot_in_project(&s.mongo, &body.bot_id, project_oid).await {
        Ok(d) => d,
        Err(e) => {
            return Json(PushResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(PushResp {
                success: false,
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(PushResp {
                success: false,
                error: Some("Bot is missing its access token.".to_owned()),
                ..Default::default()
            });
        }
    };
    let scope = body.scope.unwrap_or_default();
    if let Err(e) = validate_scope(&scope) {
        return Json(PushResp {
            success: false,
            error: Some(e),
            ..Default::default()
        });
    }

    let rows = match fetch_commands_for_push(
        &s.mongo,
        project_oid,
        bot_oid,
        &scope.kind,
        scope.chat_id.as_deref(),
        scope.user_id.as_deref(),
        body.language_code.as_deref(),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return Json(PushResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let cmds = collect_for_push(&rows);
    let scope_json = scope_to_bot_api(&ScopeDto {
        kind: scope.kind.clone(),
        chat_id: scope.chat_id.clone(),
        user_id: scope.user_id.clone(),
    });
    if let Err(e) = s
        .bot_api
        .set_my_commands_full(
            &token,
            &cmds,
            scope_json.as_ref(),
            body.language_code.as_deref(),
        )
        .await
    {
        return Json(PushResp {
            success: false,
            pushed: 0,
            error: Some(err_msg(e)),
            ..Default::default()
        });
    }
    Json(PushResp {
        success: true,
        pushed: cmds.len() as i64,
        error: None,
        message: Some(format!("Pushed {} command(s).", cmds.len())),
    })
}

// =========================================================================
//  POST /v1/telegram/commands/pull
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct PullResp {
    pub success: bool,
    pub live: Vec<BotCommandView>,
    pub local: Vec<BotCommandView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BotCommandView {
    pub command: String,
    pub description: String,
}

pub async fn pull(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<PushBody>,
) -> Json<PullResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(PullResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot = match require_bot_in_project(&s.mongo, &body.bot_id, project_oid).await {
        Ok(d) => d,
        Err(e) => {
            return Json(PullResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(PullResp {
                success: false,
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(PullResp {
                success: false,
                error: Some("Bot is missing its access token.".to_owned()),
                ..Default::default()
            });
        }
    };
    let scope = body.scope.unwrap_or_default();
    if let Err(e) = validate_scope(&scope) {
        return Json(PullResp {
            success: false,
            error: Some(e),
            ..Default::default()
        });
    }
    let scope_dto = ScopeDto {
        kind: scope.kind.clone(),
        chat_id: scope.chat_id.clone(),
        user_id: scope.user_id.clone(),
    };
    let scope_json = scope_to_bot_api(&scope_dto);
    let live = match s
        .bot_api
        .get_my_commands_full(&token, scope_json.as_ref(), body.language_code.as_deref())
        .await
    {
        Ok(list) => list
            .into_iter()
            .map(|c| BotCommandView {
                command: c.command,
                description: c.description,
            })
            .collect::<Vec<_>>(),
        Err(e) => {
            return Json(PullResp {
                success: false,
                error: Some(err_msg(e)),
                ..Default::default()
            });
        }
    };

    let rows = fetch_commands_for_push(
        &s.mongo,
        project_oid,
        bot_oid,
        &scope.kind,
        scope.chat_id.as_deref(),
        scope.user_id.as_deref(),
        body.language_code.as_deref(),
    )
    .await
    .unwrap_or_default();
    let local: Vec<BotCommandView> = rows
        .iter()
        .filter(|r| !r.hidden)
        .map(|r| BotCommandView {
            command: r.command.clone(),
            description: if r.description.is_empty() {
                r.command.clone()
            } else {
                r.description.clone()
            },
        })
        .collect();

    Json(PullResp {
        success: true,
        live,
        local,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/commands/{id}/runs
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct RunsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunRow {
    pub _id: String,
    #[serde(rename = "commandId")]
    pub command_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "userId")]
    pub user_id: Option<String>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct RunsResp {
    pub runs: Vec<RunRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn run_doc_to_row(d: &Document) -> Option<RunRow> {
    Some(RunRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        command_id: d.get_object_id("commandId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").ok().map(str::to_owned),
        user_id: d.get_str("userId").ok().map(str::to_owned),
        success: d.get_bool("success").unwrap_or(false),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

pub async fn runs(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(id): Path<String>,
    Query(q): Query<RunsQuery>,
) -> Json<RunsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(RunsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(RunsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(RunsResp {
                error: Some("invalid id".to_owned()),
                ..Default::default()
            });
        }
    };

    let mut filter = doc! { "projectId": project_oid, "commandId": oid };
    if let Some(c) = q.cursor.as_deref() {
        if let Some(co) = parse_oid(c) {
            filter.insert("_id", doc! { "$lt": co });
        }
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let cursor = match s
        .mongo
        .collection::<Document>(INVOCATIONS)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(RunsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(RunsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let runs: Vec<RunRow> = docs.iter().filter_map(run_doc_to_row).collect();
    let next_cursor = runs.last().map(|r| r._id.clone());
    Json(RunsResp {
        runs,
        next_cursor,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/commands/match (internal)
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct MatchResp {
    pub matched: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<CommandRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Scope precedence: most specific → least specific.
/// chat_member > chat_administrators > chat > all_chat_administrators
/// > all_group_chats > all_private_chats > default.
fn scope_priority(kind: &str) -> i32 {
    match kind {
        SCOPE_CHAT_MEMBER => 70,
        SCOPE_CHAT_ADMINS => 60,
        SCOPE_CHAT => 50,
        SCOPE_ALL_CHAT_ADMINS => 40,
        SCOPE_ALL_GROUPS => 30,
        SCOPE_ALL_PRIVATE => 20,
        SCOPE_DEFAULT => 10,
        _ => 0,
    }
}

fn scope_applies(row: &CommandRow, chat_id: Option<&str>, user_id: Option<&str>) -> bool {
    let s = &row.scope;
    match s.kind.as_str() {
        SCOPE_DEFAULT | SCOPE_ALL_PRIVATE | SCOPE_ALL_GROUPS | SCOPE_ALL_CHAT_ADMINS => true,
        SCOPE_CHAT | SCOPE_CHAT_ADMINS => s
            .chat_id
            .as_deref()
            .zip(chat_id)
            .map(|(a, b)| a == b)
            .unwrap_or(false),
        SCOPE_CHAT_MEMBER => {
            let chat_ok = s
                .chat_id
                .as_deref()
                .zip(chat_id)
                .map(|(a, b)| a == b)
                .unwrap_or(false);
            let user_ok = s
                .user_id
                .as_deref()
                .zip(user_id)
                .map(|(a, b)| a == b)
                .unwrap_or(false);
            chat_ok && user_ok
        }
        _ => false,
    }
}

/// Internal: select the best matching command definition by scope
/// precedence. Exposed so the future webhook dispatcher can call it
/// directly without a HTTP round-trip.
pub async fn match_command(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    command: &str,
    chat_id: Option<&str>,
    user_id: Option<&str>,
    language_code: Option<&str>,
) -> Result<Option<CommandRow>, String> {
    let normalized = command.trim().trim_start_matches('/').to_lowercase();
    let coll = mongo.collection::<Document>(DEFINITIONS);
    let mut filter = doc! {
        "projectId": project_oid,
        "command": &normalized,
        "$or": vec![
            doc! { "botId": bot_oid },
            doc! { "botId": Bson::Null },
        ],
    };
    if let Some(lc) = language_code {
        filter.insert(
            "$and",
            vec![doc! {
                "$or": vec![
                    doc! { "languageCode": lc },
                    doc! { "languageCode": { "$exists": false } },
                ]
            }],
        );
    }
    let cursor = coll.find(filter).await.map_err(|e| format!("mongo: {e}"))?;
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let mut candidates: Vec<CommandRow> = docs.iter().filter_map(doc_to_row).collect();
    candidates.retain(|r| scope_applies(r, chat_id, user_id));
    if candidates.is_empty() {
        return Ok(None);
    }
    candidates.sort_by(|a, b| {
        let pa = scope_priority(&a.scope.kind);
        let pb = scope_priority(&b.scope.kind);
        if pa != pb {
            return pb.cmp(&pa);
        }
        // language-coded definitions win over universal ones
        let la = a.language_code.is_some();
        let lb = b.language_code.is_some();
        if la != lb {
            return lb.cmp(&la);
        }
        // per-bot wins over project-wide
        let ba = a.bot_id.is_some();
        let bb = b.bot_id.is_some();
        bb.cmp(&ba)
    });
    Ok(candidates.into_iter().next())
}

pub async fn match_handler(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<MatchBody>,
) -> Json<MatchResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(MatchResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot = match require_bot_in_project(&s.mongo, &body.bot_id, project_oid).await {
        Ok(d) => d,
        Err(e) => {
            return Json(MatchResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(MatchResp {
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    match match_command(
        &s.mongo,
        project_oid,
        bot_oid,
        &body.command,
        body.chat_id.as_deref(),
        body.user_id.as_deref(),
        body.language_code.as_deref(),
    )
    .await
    {
        Ok(Some(row)) => Json(MatchResp {
            matched: true,
            command: Some(row),
            error: None,
        }),
        Ok(None) => Json(MatchResp {
            matched: false,
            ..Default::default()
        }),
        Err(e) => Json(MatchResp {
            error: Some(e),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  POST /v1/telegram/commands/log (internal)
// =========================================================================

/// Internal: append an invocation log row and bump the parent
/// definition's `runCount` / `lastRunAt`. Exposed for the future
/// webhook dispatcher.
pub async fn log_invocation(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    command_oid: ObjectId,
    chat_id: Option<&str>,
    user_id: Option<&str>,
    success: bool,
    error_message: Option<&str>,
) -> Result<(), String> {
    let now = bson::DateTime::now();
    let mut entry = doc! {
        "projectId": project_oid,
        "commandId": command_oid,
        "botId": bot_oid,
        "success": success,
        "createdAt": now,
    };
    if let Some(c) = chat_id {
        entry.insert("chatId", c);
    }
    if let Some(u) = user_id {
        entry.insert("userId", u);
    }
    if let Some(m) = error_message {
        entry.insert("errorMessage", m);
    }
    mongo
        .collection::<Document>(INVOCATIONS)
        .insert_one(entry)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let _ = mongo
        .collection::<Document>(DEFINITIONS)
        .update_one(
            doc! { "_id": command_oid, "projectId": project_oid },
            doc! {
                "$inc": { "runCount": 1i64 },
                "$set": { "lastRunAt": now },
            },
        )
        .await;
    Ok(())
}

pub async fn log_handler(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<LogBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot = match require_bot_in_project(&s.mongo, &body.bot_id, project_oid).await {
        Ok(d) => d,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot not found."),
    };
    let cmd_oid = match parse_oid(&body.command_id) {
        Some(o) => o,
        None => return err_ack("invalid commandId"),
    };
    match log_invocation(
        &s.mongo,
        project_oid,
        bot_oid,
        cmd_oid,
        body.chat_id.as_deref(),
        body.user_id.as_deref(),
        body.success,
        body.error_message.as_deref(),
    )
    .await
    {
        Ok(()) => ok_ack(Some("Logged.".to_owned()), Some(body.command_id)),
        Err(e) => err_ack(e),
    }
}

// =========================================================================
//  GET /v1/telegram/commands/analytics
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PerCommandStat {
    #[serde(rename = "commandId")]
    pub command_id: String,
    pub command: String,
    pub runs: i64,
    pub success: i64,
    pub failures: i64,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsByDayPoint {
    pub date: String,
    pub runs: i64,
    pub success: i64,
    pub failures: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    #[serde(rename = "totalRuns")]
    pub total_runs: i64,
    #[serde(rename = "totalSuccess")]
    pub total_success: i64,
    #[serde(rename = "totalFailures")]
    pub total_failures: i64,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
    #[serde(rename = "perCommand")]
    pub per_command: Vec<PerCommandStat>,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsByDayPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
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
    let mut range = doc! {};
    range.insert("$gte", bson::DateTime::from_millis(from.timestamp_millis()));
    range.insert("$lte", bson::DateTime::from_millis(to.timestamp_millis()));
    filter.insert("createdAt", range);
    if let Some(b) = q.bot_id.as_deref().filter(|s| !s.is_empty()) {
        if let Some(o) = parse_oid(b) {
            filter.insert("botId", o);
        }
    }

    let cursor = match s
        .mongo
        .collection::<Document>(INVOCATIONS)
        .find(filter)
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
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    use std::collections::{BTreeMap, HashMap};
    let mut per_cmd: HashMap<String, (i64, i64)> = HashMap::new();
    let mut per_day: BTreeMap<String, (i64, i64)> = BTreeMap::new();

    let mut day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while day <= end_day && guard < 400 {
        per_day.insert(day.format("%Y-%m-%d").to_string(), (0, 0));
        match day.succ_opt() {
            Some(next) => day = next,
            None => break,
        }
        guard += 1;
    }

    let mut total_runs: i64 = 0;
    let mut total_success: i64 = 0;

    for d in &docs {
        total_runs += 1;
        let success = d.get_bool("success").unwrap_or(false);
        if success {
            total_success += 1;
        }
        let created = dt(d.get_datetime("createdAt").ok().copied());
        let key = format!(
            "{:04}-{:02}-{:02}",
            created.year(),
            created.month(),
            created.day()
        );
        let entry = per_day.entry(key).or_insert((0, 0));
        entry.0 += 1;
        if success {
            entry.1 += 1;
        }
        if let Ok(cid) = d.get_object_id("commandId") {
            let cmd_key = cid.to_hex();
            let e = per_cmd.entry(cmd_key).or_insert((0, 0));
            e.0 += 1;
            if success {
                e.1 += 1;
            }
        }
    }

    let mut per_command: Vec<PerCommandStat> = Vec::new();
    if !per_cmd.is_empty() {
        let oids: Vec<ObjectId> = per_cmd.keys().filter_map(|k| parse_oid(k)).collect();
        if !oids.is_empty() {
            if let Ok(cur) = s
                .mongo
                .collection::<Document>(DEFINITIONS)
                .find(doc! { "_id": { "$in": &oids }, "projectId": project_oid })
                .await
            {
                let defs: Vec<Document> = cur.try_collect().await.unwrap_or_default();
                let names: HashMap<String, String> = defs
                    .iter()
                    .filter_map(|d| {
                        Some((
                            d.get_object_id("_id").ok()?.to_hex(),
                            d.get_str("command").unwrap_or("").to_owned(),
                        ))
                    })
                    .collect();
                for (cid, (runs, succ)) in &per_cmd {
                    let failures = runs - succ;
                    let rate = if *runs > 0 {
                        (*succ as f64 / *runs as f64) * 100.0
                    } else {
                        0.0
                    };
                    per_command.push(PerCommandStat {
                        command_id: cid.clone(),
                        command: names.get(cid).cloned().unwrap_or_default(),
                        runs: *runs,
                        success: *succ,
                        failures,
                        success_rate: rate,
                    });
                }
            }
        }
    }
    per_command.sort_by(|a, b| b.runs.cmp(&a.runs));

    let by_day: Vec<AnalyticsByDayPoint> = per_day
        .into_iter()
        .map(|(date, (runs, succ))| AnalyticsByDayPoint {
            date,
            runs,
            success: succ,
            failures: runs - succ,
        })
        .collect();
    let success_rate = if total_runs > 0 {
        (total_success as f64 / total_runs as f64) * 100.0
    } else {
        0.0
    };
    Json(AnalyticsResp {
        total_runs,
        total_success,
        total_failures: total_runs - total_success,
        success_rate,
        per_command,
        by_day,
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/commands/import
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct ImportResp {
    pub success: bool,
    pub inserted: i64,
    pub skipped: i64,
    pub errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn import(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Json(body): Json<ImportBody>,
) -> Json<ImportResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ImportResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let coll = s.mongo.collection::<Document>(DEFINITIONS);
    let now = bson::DateTime::now();
    let mut inserted: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for c in &body.commands {
        let cmd = normalize_command(&c.command);
        if let Err(e) = validate_command_name(&cmd) {
            skipped += 1;
            errors.push(format!("{}: {}", c.command, e));
            continue;
        }
        let description = c.description.clone().unwrap_or_default();
        if description.chars().count() > 256 {
            skipped += 1;
            errors.push(format!("{}: description too long", c.command));
            continue;
        }
        let scope = c.scope.clone().unwrap_or_default();
        if let Err(e) = validate_scope(&scope) {
            skipped += 1;
            errors.push(format!("{}: {}", c.command, e));
            continue;
        }
        let handler = c.handler.clone().unwrap_or_default();
        if let Err(e) = validate_handler(&handler) {
            skipped += 1;
            errors.push(format!("{}: {}", c.command, e));
            continue;
        }
        let bot_oid = match c.bot_id.as_deref().filter(|b| !b.is_empty()) {
            Some(b) => match parse_oid(b) {
                Some(o) => {
                    if require_bot_in_project(&s.mongo, b, project_oid)
                        .await
                        .is_err()
                    {
                        skipped += 1;
                        errors.push(format!("{}: bot not found in project", c.command));
                        continue;
                    }
                    Some(o)
                }
                None => {
                    skipped += 1;
                    errors.push(format!("{}: invalid bot id", c.command));
                    continue;
                }
            },
            None => None,
        };

        if ensure_no_duplicate(
            &coll,
            project_oid,
            bot_oid,
            &cmd,
            &scope.kind,
            scope.chat_id.as_deref(),
            scope.user_id.as_deref(),
            c.language_code.as_deref(),
            None,
        )
        .await
        .is_err()
        {
            skipped += 1;
            errors.push(format!("{}: duplicate", c.command));
            continue;
        }

        let mut d = doc! {
            "projectId": project_oid,
            "command": &cmd,
            "description": &description,
            "scope": scope_to_doc(&scope),
            "handler": handler_to_doc(&handler),
            "hidden": c.hidden.unwrap_or(false),
            "runCount": 0i64,
            "createdAt": now,
            "updatedAt": now,
        };
        match bot_oid {
            Some(b) => {
                d.insert("botId", b);
            }
            None => {
                d.insert("botId", Bson::Null);
            }
        }
        if let Some(lc) = c.language_code.as_deref().filter(|s| !s.is_empty()) {
            d.insert("languageCode", lc);
        }
        match coll.insert_one(d).await {
            Ok(_) => inserted += 1,
            Err(e) => {
                skipped += 1;
                errors.push(format!("{}: mongo: {}", c.command, e));
            }
        }
    }
    Json(ImportResp {
        success: true,
        inserted,
        skipped,
        errors,
        error: None,
    })
}

// =========================================================================
//  GET /v1/telegram/commands/export
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ExportQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_owned()
    }
}

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Query(q): Query<ExportQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "projectId is required").into_response(),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    let cursor = match s
        .mongo
        .collection::<Document>(DEFINITIONS)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "command": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    let rows: Vec<CommandRow> = docs.iter().filter_map(doc_to_row).collect();
    let mut body = String::from(
        "command,description,bot_id,scope,scope_chat_id,scope_user_id,language_code,handler,hidden,run_count,created_at\n",
    );
    for r in rows {
        body.push_str(&csv_escape(&r.command));
        body.push(',');
        body.push_str(&csv_escape(&r.description));
        body.push(',');
        body.push_str(&csv_escape(r.bot_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(&r.scope.kind));
        body.push(',');
        body.push_str(&csv_escape(r.scope.chat_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.scope.user_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.language_code.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(&r.handler.kind));
        body.push(',');
        body.push_str(if r.hidden { "true" } else { "false" });
        body.push(',');
        body.push_str(&r.run_count.to_string());
        body.push(',');
        body.push_str(&r.created_at.to_rfc3339());
        body.push('\n');
    }
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"telegram-commands.csv\""),
    );
    (StatusCode::OK, headers, body).into_response()
}
