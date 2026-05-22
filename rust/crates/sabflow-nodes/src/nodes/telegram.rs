//! Telegram node — bot operations against the Telegram Bot API.
//!
//! Implements the four Telegram resources surfaced by the SabFlow UI:
//! - `message`: send/edit/delete/pin/unpin messages, send photos, documents, locations
//! - `chat`:    get chat info, get/list members, leave a chat
//! - `file`:    look up a file path for downloading
//! - `callback`: answer inline-keyboard callback queries
//!
//! Auth: credential `data["accessToken"]` holds a bot token of the form
//! `1234567890:ABCdef...`. All requests are POST against
//! `https://api.telegram.org/bot{token}/{method}` with a JSON body. The
//! response envelope is `{ok, result?, description?}` — on `ok=false` we
//! map to `NodeError::UpstreamError`, otherwise we emit the `result` value
//! as the single output item.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

const TELEGRAM_API: &str = "https://api.telegram.org";

pub struct TelegramNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TelegramNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "telegram",
            "Telegram",
            "Send messages, manage chats, and answer callbacks via the Telegram Bot API",
            NodeCategory::Communication,
        )
        .icon("send")
        .color("#0088CC")
        .credentials(vec![CredentialBinding {
            name: "telegramApi".into(),
            display_name: "Telegram Bot Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Message", "message"),
                    opt("Chat", "chat"),
                    opt("File", "file"),
                    opt("Callback", "callback"),
                ])
                .default(json!("message"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Message", "sendMessage"),
                    opt("Send Photo", "sendPhoto"),
                    opt("Send Document", "sendDocument"),
                    opt("Send Location", "sendLocation"),
                    opt("Edit Message Text", "editMessageText"),
                    opt("Delete Message", "deleteMessage"),
                    opt("Pin Message", "pinMessage"),
                    opt("Unpin Message", "unpinMessage"),
                    opt("Get Chat", "get"),
                    opt("Get Chat Member", "getMember"),
                    opt("Get Administrators", "getAdministrators"),
                    opt("Get Member Count", "getMemberCount"),
                    opt("Leave Chat", "leave"),
                    opt("Get File", "get"),
                    opt("Answer Callback Query", "answer"),
                ])
                .default(json!("sendMessage"))
                .required(),
            NodeProperty::new("chatId", "Chat ID", NodePropertyType::String)
                .description("Chat ID or @channel_username")
                .show_when(
                    "operation",
                    &[
                        "sendMessage",
                        "sendPhoto",
                        "sendDocument",
                        "sendLocation",
                        "editMessageText",
                        "deleteMessage",
                        "pinMessage",
                        "unpinMessage",
                        "get",
                        "getMember",
                        "getAdministrators",
                        "getMemberCount",
                        "leave",
                    ],
                ),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .show_when("operation", &["sendMessage", "editMessageText"]),
            NodeProperty::new("parseMode", "Parse Mode", NodePropertyType::Options)
                .options(vec![
                    opt("None", "none"),
                    opt("Markdown", "Markdown"),
                    opt("MarkdownV2", "MarkdownV2"),
                    opt("HTML", "HTML"),
                ])
                .default(json!("none"))
                .show_when("operation", &["sendMessage", "editMessageText"]),
            NodeProperty::new(
                "disableWebPagePreview",
                "Disable Web Page Preview",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .show_when("operation", &["sendMessage"]),
            NodeProperty::new(
                "disableNotification",
                "Disable Notification",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .show_when("operation", &["sendMessage", "sendPhoto"]),
            NodeProperty::new(
                "replyToMessageId",
                "Reply To Message ID",
                NodePropertyType::Number,
            )
            .show_when("operation", &["sendMessage"]),
            NodeProperty::new("photoUrl", "Photo URL", NodePropertyType::String)
                .show_when("operation", &["sendPhoto"]),
            NodeProperty::new("caption", "Caption", NodePropertyType::String)
                .show_when("operation", &["sendPhoto", "sendDocument"]),
            NodeProperty::new("documentUrl", "Document URL", NodePropertyType::String)
                .show_when("operation", &["sendDocument"]),
            NodeProperty::new("latitude", "Latitude", NodePropertyType::Number)
                .show_when("operation", &["sendLocation"]),
            NodeProperty::new("longitude", "Longitude", NodePropertyType::Number)
                .show_when("operation", &["sendLocation"]),
            NodeProperty::new("messageId", "Message ID", NodePropertyType::Number).show_when(
                "operation",
                &[
                    "editMessageText",
                    "deleteMessage",
                    "pinMessage",
                    "unpinMessage",
                ],
            ),
            NodeProperty::new("userId", "User ID", NodePropertyType::Number)
                .show_when("operation", &["getMember"]),
            NodeProperty::new("fileId", "File ID", NodePropertyType::String)
                .show_when("operation", &["get"])
                .show_when("resource", &["file"]),
            NodeProperty::new(
                "callbackQueryId",
                "Callback Query ID",
                NodePropertyType::String,
            )
            .show_when("operation", &["answer"]),
            NodeProperty::new("callbackText", "Callback Text", NodePropertyType::String)
                .show_when("operation", &["answer"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;
        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "message".to_string());

        // Resolve the Telegram Bot API method + payload for the requested operation.
        // The `file` resource shares the `"get"` operation key with `chat:get`, so
        // we disambiguate via `resource` for that one.
        let (method, payload) = match operation.as_str() {
            "sendMessage" => ("sendMessage", build_send_message(ctx, params)?),
            "sendPhoto" => ("sendPhoto", build_send_photo(ctx, params)?),
            "sendDocument" => ("sendDocument", build_send_document(ctx, params)?),
            "sendLocation" => ("sendLocation", build_send_location(ctx, params)?),
            "editMessageText" => ("editMessageText", build_edit_message_text(ctx, params)?),
            "deleteMessage" => ("deleteMessage", build_chat_message_id(ctx, params)?),
            "pinMessage" => ("pinChatMessage", build_chat_message_id(ctx, params)?),
            "unpinMessage" => ("unpinChatMessage", build_chat_message_id(ctx, params)?),
            "get" => {
                if resource == "file" {
                    ("getFile", build_file_get(ctx, params)?)
                } else {
                    ("getChat", build_chat_only(ctx, params)?)
                }
            }
            "getMember" => ("getChatMember", build_get_member(ctx, params)?),
            "getAdministrators" => ("getChatAdministrators", build_chat_only(ctx, params)?),
            "getMemberCount" => ("getChatMemberCount", build_chat_only(ctx, params)?),
            "leave" => ("leaveChat", build_chat_only(ctx, params)?),
            "answer" => ("answerCallbackQuery", build_answer(ctx, params)?),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let url = format!("{TELEGRAM_API}/bot{token}/{method}");
        let res = ctx.http.post(&url).json(&payload).send().await?;
        let status = res.status();
        let body_bytes = res.bytes().await?;
        let body_value: Value = if body_bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&body_bytes).unwrap_or_else(|_| {
                Value::String(String::from_utf8_lossy(&body_bytes).into_owned())
            })
        };

        // Transport-level failure (e.g. 404 on the bot URL when the token is invalid).
        // Telegram still typically replies with `{ok: false, description}` even on
        // HTTP 4xx, so we surface either path through UpstreamError.
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: describe_body(&body_value),
            });
        }

        // Telegram's envelope: {ok: bool, result?: ..., description?: ...}
        let ok = body_value
            .get("ok")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !ok {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: describe_body(&body_value),
            });
        }

        let result = body_value.get("result").cloned().unwrap_or(Value::Null);
        Ok(NodeOutput::single(vec![result]))
    }
}

// -- payload builders ---------------------------------------------------------

fn require_chat_id(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = ctx.param_str(params, "chatId")?;
    if chat_id.trim().is_empty() {
        return Err(NodeError::MissingParameter("chatId".into()));
    }
    // Allow numeric IDs (including negative supergroup IDs) and @usernames.
    if let Ok(n) = chat_id.parse::<i64>() {
        Ok(json!(n))
    } else {
        Ok(Value::String(chat_id))
    }
}

fn require_message_id(params: &Value) -> NodeResult<i64> {
    params
        .get("messageId")
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
        .ok_or_else(|| NodeError::MissingParameter("messageId".into()))
}

fn require_f64(params: &Value, key: &str) -> NodeResult<f64> {
    params
        .get(key)
        .and_then(|v| v.as_f64())
        .ok_or_else(|| NodeError::MissingParameter(key.into()))
}

fn require_str(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let s = ctx.param_str(params, key)?;
    if s.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.into()));
    }
    Ok(s)
}

fn build_send_message(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let text = require_str(ctx, params, "text")?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("text".into(), Value::String(text));

    if let Some(parse_mode) = ctx.param_str_opt(params, "parseMode") {
        if parse_mode != "none" && !parse_mode.is_empty() {
            map.insert("parse_mode".into(), Value::String(parse_mode));
        }
    }
    if let Some(v) = params
        .get("disableWebPagePreview")
        .and_then(|v| v.as_bool())
    {
        map.insert("disable_web_page_preview".into(), Value::Bool(v));
    }
    if let Some(v) = params.get("disableNotification").and_then(|v| v.as_bool()) {
        map.insert("disable_notification".into(), Value::Bool(v));
    }
    if let Some(reply_to) = params
        .get("replyToMessageId")
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
    {
        map.insert("reply_to_message_id".into(), json!(reply_to));
    }
    Ok(Value::Object(map))
}

fn build_send_photo(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let photo = require_str(ctx, params, "photoUrl")?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("photo".into(), Value::String(photo));
    if let Some(caption) = ctx.param_str_opt(params, "caption") {
        if !caption.is_empty() {
            map.insert("caption".into(), Value::String(caption));
        }
    }
    if let Some(v) = params.get("disableNotification").and_then(|v| v.as_bool()) {
        map.insert("disable_notification".into(), Value::Bool(v));
    }
    Ok(Value::Object(map))
}

fn build_send_document(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let document = require_str(ctx, params, "documentUrl")?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("document".into(), Value::String(document));
    if let Some(caption) = ctx.param_str_opt(params, "caption") {
        if !caption.is_empty() {
            map.insert("caption".into(), Value::String(caption));
        }
    }
    Ok(Value::Object(map))
}

fn build_send_location(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let latitude = require_f64(params, "latitude")?;
    let longitude = require_f64(params, "longitude")?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("latitude".into(), json!(latitude));
    map.insert("longitude".into(), json!(longitude));
    Ok(Value::Object(map))
}

fn build_edit_message_text(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let message_id = require_message_id(params)?;
    let text = require_str(ctx, params, "text")?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("message_id".into(), json!(message_id));
    map.insert("text".into(), Value::String(text));
    if let Some(parse_mode) = ctx.param_str_opt(params, "parseMode") {
        if parse_mode != "none" && !parse_mode.is_empty() {
            map.insert("parse_mode".into(), Value::String(parse_mode));
        }
    }
    Ok(Value::Object(map))
}

fn build_chat_message_id(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let message_id = require_message_id(params)?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("message_id".into(), json!(message_id));
    Ok(Value::Object(map))
}

fn build_chat_only(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    Ok(Value::Object(map))
}

fn build_get_member(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let chat_id = require_chat_id(ctx, params)?;
    let user_id = params
        .get("userId")
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
        .ok_or_else(|| NodeError::MissingParameter("userId".into()))?;
    let mut map = Map::new();
    map.insert("chat_id".into(), chat_id);
    map.insert("user_id".into(), json!(user_id));
    Ok(Value::Object(map))
}

fn build_file_get(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let file_id = require_str(ctx, params, "fileId")?;
    let mut map = Map::new();
    map.insert("file_id".into(), Value::String(file_id));
    Ok(Value::Object(map))
}

fn build_answer(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let callback_query_id = require_str(ctx, params, "callbackQueryId")?;
    let mut map = Map::new();
    map.insert("callback_query_id".into(), Value::String(callback_query_id));
    if let Some(text) = ctx.param_str_opt(params, "callbackText") {
        if !text.is_empty() {
            map.insert("text".into(), Value::String(text));
        }
    }
    Ok(Value::Object(map))
}

/// Render the most useful failure message from a Telegram response body.
/// Prefers `description`, then `error_code`/full body fallback.
fn describe_body(body: &Value) -> String {
    if let Some(desc) = body.get("description").and_then(|v| v.as_str()) {
        return desc.to_string();
    }
    match body {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}
