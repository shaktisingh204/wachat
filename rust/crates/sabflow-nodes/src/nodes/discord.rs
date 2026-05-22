//! Discord node — webhook and bot operations.
//!
//! Two modes:
//! - `webhook`: POST to a discord webhook URL (no credential required).
//! - `bot`: authenticated Discord REST API calls via a bot token credential
//!   (`Authorization: Bot <token>`).

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

const DISCORD_API: &str = "https://discord.com/api/v10";

pub struct DiscordNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for DiscordNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "discord",
            "Discord",
            "Send Discord messages via webhook or bot API",
            NodeCategory::Communication,
        )
        .icon("hash")
        .color("#5865F2")
        .credentials(vec![CredentialBinding {
            name: "discordApi".into(),
            display_name: "Discord Bot Token".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![opt("Webhook", "webhook"), opt("Bot", "bot")])
                .default(json!("webhook"))
                .required(),
            NodeProperty::new("webhookUrl", "Webhook URL", NodePropertyType::String)
                .placeholder("https://discord.com/api/webhooks/{id}/{token}")
                .show_when("mode", &["webhook"])
                .description("Full Discord webhook URL"),
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .show_when("mode", &["bot"]),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send (Webhook)", "send"),
                    opt("Send Message", "sendMessage"),
                    opt("Edit Message", "editMessage"),
                    opt("Delete Message", "deleteMessage"),
                    opt("List Channels", "listChannels"),
                    opt("List Guilds", "listGuilds"),
                ])
                .default(json!("send"))
                .required(),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["sendMessage", "editMessage", "deleteMessage"],
                )
                .description("Discord channel snowflake ID"),
            NodeProperty::new("messageId", "Message ID", NodePropertyType::String)
                .show_when("operation", &["editMessage", "deleteMessage"]),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .show_when("operation", &["send", "sendMessage", "editMessage"])
                .description("Message text content"),
            NodeProperty::new("username", "Username", NodePropertyType::String)
                .show_when("mode", &["webhook"])
                .description("Override the default webhook display name"),
            NodeProperty::new("avatarUrl", "Avatar URL", NodePropertyType::String)
                .show_when("mode", &["webhook"])
                .description("Override the default webhook avatar"),
            NodeProperty::new("embeds", "Embeds", NodePropertyType::Json)
                .description("Optional array of Discord embed objects"),
            NodeProperty::new("guildId", "Guild ID", NodePropertyType::String)
                .show_when("operation", &["listChannels"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let mode = ctx
            .param_str_opt(params, "mode")
            .unwrap_or_else(|| "webhook".to_string());
        let operation = ctx.param_str_opt(params, "operation").unwrap_or_else(|| {
            if mode == "bot" {
                "sendMessage".to_string()
            } else {
                "send".to_string()
            }
        });

        match mode.as_str() {
            "webhook" => execute_webhook(ctx, params, &operation).await,
            "bot" => execute_bot(ctx, params, &operation).await,
            other => Err(NodeError::InvalidParameter {
                name: "mode".into(),
                reason: format!("unknown mode: {other}"),
            }),
        }
    }
}

async fn execute_webhook(
    ctx: &ExecutionContext,
    params: &Value,
    operation: &str,
) -> NodeResult<NodeOutput> {
    if operation != "send" {
        return Err(NodeError::InvalidParameter {
            name: "operation".into(),
            reason: format!("operation '{operation}' is not valid in webhook mode (use 'send')"),
        });
    }

    let webhook_url_raw = ctx.param_str(params, "webhookUrl")?;
    let webhook_url = webhook_url_raw.trim().to_string();
    if webhook_url.is_empty() {
        return Err(NodeError::MissingParameter("webhookUrl".into()));
    }

    let mut payload = Map::new();
    if let Some(content) = ctx.param_str_opt(params, "content") {
        if !content.is_empty() {
            payload.insert("content".into(), Value::String(content));
        }
    }
    if let Some(username) = ctx.param_str_opt(params, "username") {
        if !username.is_empty() {
            payload.insert("username".into(), Value::String(username));
        }
    }
    if let Some(avatar) = ctx.param_str_opt(params, "avatarUrl") {
        if !avatar.is_empty() {
            payload.insert("avatar_url".into(), Value::String(avatar));
        }
    }
    if let Some(embeds) = resolve_embeds(ctx, params) {
        payload.insert("embeds".into(), embeds);
    }

    // Discord requires either content or embeds.
    if payload.get("content").is_none() && payload.get("embeds").is_none() {
        return Err(NodeError::MissingParameter(
            "content or embeds (webhook requires at least one)".into(),
        ));
    }

    // ?wait=true makes Discord return the created message JSON instead of 204 No Content.
    let res = ctx
        .http
        .post(&webhook_url)
        .query(&[("wait", "true")])
        .json(&Value::Object(payload))
        .send()
        .await?;

    let status = res.status();
    let body_bytes = res.bytes().await?;
    let body_value = parse_body(&body_bytes);

    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_to_error_string(&body_value),
        });
    }

    Ok(NodeOutput::single(vec![body_value]))
}

async fn execute_bot(
    ctx: &ExecutionContext,
    params: &Value,
    operation: &str,
) -> NodeResult<NodeOutput> {
    let cred_id = ctx.param_str(params, "credentialId")?;
    let cred = ctx.credential(&cred_id)?;
    let token = cred
        .data
        .get("botToken")
        .or_else(|| cred.data.get("token"))
        .or_else(|| cred.data.get("apiKey"))
        .ok_or_else(|| NodeError::MissingParameter("botToken".into()))?
        .clone();
    let auth_header = format!("Bot {token}");

    match operation {
        "sendMessage" => {
            let channel_id = ctx.param_str(params, "channelId")?;
            if channel_id.is_empty() {
                return Err(NodeError::MissingParameter("channelId".into()));
            }

            let mut payload = Map::new();
            if let Some(content) = ctx.param_str_opt(params, "content") {
                if !content.is_empty() {
                    payload.insert("content".into(), Value::String(content));
                }
            }
            if let Some(embeds) = resolve_embeds(ctx, params) {
                payload.insert("embeds".into(), embeds);
            }
            if payload.get("content").is_none() && payload.get("embeds").is_none() {
                return Err(NodeError::MissingParameter(
                    "content or embeds (sendMessage requires at least one)".into(),
                ));
            }

            let url = format!("{DISCORD_API}/channels/{channel_id}/messages");
            let res = ctx
                .http
                .post(&url)
                .header("Authorization", &auth_header)
                .json(&Value::Object(payload))
                .send()
                .await?;
            finalize(res).await
        }
        "editMessage" => {
            let channel_id = ctx.param_str(params, "channelId")?;
            let message_id = ctx.param_str(params, "messageId")?;
            if channel_id.is_empty() {
                return Err(NodeError::MissingParameter("channelId".into()));
            }
            if message_id.is_empty() {
                return Err(NodeError::MissingParameter("messageId".into()));
            }

            let mut payload = Map::new();
            if let Some(content) = ctx.param_str_opt(params, "content") {
                payload.insert("content".into(), Value::String(content));
            }
            if let Some(embeds) = resolve_embeds(ctx, params) {
                payload.insert("embeds".into(), embeds);
            }

            let url = format!("{DISCORD_API}/channels/{channel_id}/messages/{message_id}");
            let res = ctx
                .http
                .patch(&url)
                .header("Authorization", &auth_header)
                .json(&Value::Object(payload))
                .send()
                .await?;
            finalize(res).await
        }
        "deleteMessage" => {
            let channel_id = ctx.param_str(params, "channelId")?;
            let message_id = ctx.param_str(params, "messageId")?;
            if channel_id.is_empty() {
                return Err(NodeError::MissingParameter("channelId".into()));
            }
            if message_id.is_empty() {
                return Err(NodeError::MissingParameter("messageId".into()));
            }

            let url = format!("{DISCORD_API}/channels/{channel_id}/messages/{message_id}");
            let res = ctx
                .http
                .delete(&url)
                .header("Authorization", &auth_header)
                .send()
                .await?;

            let status = res.status();
            let body_bytes = res.bytes().await?;
            let body_value = if body_bytes.is_empty() {
                json!({ "deleted": true, "messageId": message_id, "channelId": channel_id })
            } else {
                parse_body(&body_bytes)
            };

            if !status.is_success() {
                return Err(NodeError::UpstreamError {
                    status: status.as_u16(),
                    body: body_to_error_string(&body_value),
                });
            }
            Ok(NodeOutput::single(vec![body_value]))
        }
        "listChannels" => {
            let guild_id = ctx.param_str(params, "guildId")?;
            if guild_id.is_empty() {
                return Err(NodeError::MissingParameter("guildId".into()));
            }
            let url = format!("{DISCORD_API}/guilds/{guild_id}/channels");
            let res = ctx
                .http
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await?;
            finalize(res).await
        }
        "listGuilds" => {
            let url = format!("{DISCORD_API}/users/@me/guilds");
            let res = ctx
                .http
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await?;
            finalize(res).await
        }
        other => Err(NodeError::InvalidParameter {
            name: "operation".into(),
            reason: format!("unknown bot operation: {other}"),
        }),
    }
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let body_bytes = res.bytes().await?;
    let body_value = parse_body(&body_bytes);

    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_to_error_string(&body_value),
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}

fn parse_body(bytes: &[u8]) -> Value {
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice::<Value>(bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(bytes).into_owned()))
}

fn body_to_error_string(body: &Value) -> String {
    match body {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Resolve the optional `embeds` JSON property. Accepts either a JSON array
/// directly, or a string containing a JSON-encoded array (frontends sometimes
/// stash Json properties as strings).
fn resolve_embeds(ctx: &ExecutionContext, params: &Value) -> Option<Value> {
    let raw = params.get("embeds")?;
    let resolved = match raw {
        Value::String(s) => {
            let sub = ctx.substitute(s);
            if sub.trim().is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(&sub).unwrap_or(Value::String(sub))
        }
        other => substitute_value(ctx, other.clone()),
    };
    match &resolved {
        Value::Null => None,
        Value::Array(arr) if arr.is_empty() => None,
        Value::Object(map) if map.is_empty() => None,
        _ => Some(resolved),
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}
