//! Slack node.
//!
//! Implements message / channel / user operations against the Slack Web API
//! (https://slack.com/api). Authenticates with a bot or user access token
//! supplied via the `slackApi` credential (`accessToken` field).

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

pub struct SlackNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const SLACK_API_BASE: &str = "https://slack.com/api";

#[async_trait]
impl Node for SlackNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "slack",
            "Slack",
            "Send Slack messages and manage channels & users",
            NodeCategory::Communication,
        )
        .icon("message-square")
        .color("#4A154B")
        .credentials(vec![CredentialBinding {
            name: "slackApi".into(),
            display_name: "Slack API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Message", "message"),
                    opt("Channel", "channel"),
                    opt("User", "user"),
                ])
                .default(json!("message"))
                .required(),
            // Message operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send", "send"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Get History", "getHistory"),
                ])
                .default(json!("send"))
                .show_when("resource", &["message"])
                .required(),
            // Channel operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Info", "info"),
                    opt("Create", "create"),
                ])
                .default(json!("list"))
                .show_when("resource", &["channel"])
                .required(),
            // User operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Info", "info")])
                .default(json!("list"))
                .show_when("resource", &["user"])
                .required(),
            // Shared channel input (used by message:* and channel:info)
            NodeProperty::new("channel", "Channel", NodePropertyType::String)
                .placeholder("#general or C01234567")
                .show_when(
                    "operation",
                    &["send", "update", "delete", "getHistory", "info"],
                )
                .description("Channel ID or name (e.g. #general or C01234567)"),
            // message:send
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when("operation", &["send", "update"]),
            NodeProperty::new("jsonBlocks", "Blocks (JSON)", NodePropertyType::Json)
                .show_when("operation", &["send"])
                .description("Slack Block Kit blocks as a JSON array"),
            NodeProperty::new("attachments", "Attachments (JSON)", NodePropertyType::Json)
                .show_when("operation", &["send"])
                .description("Legacy attachments as a JSON array"),
            // message:update / delete
            NodeProperty::new(
                "messageTs",
                "Message Timestamp (ts)",
                NodePropertyType::String,
            )
            .placeholder("1234567890.123456")
            .show_when("operation", &["update", "delete"]),
            // message:getHistory
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["getHistory"]),
            // channel:create
            NodeProperty::new("name", "Channel Name", NodePropertyType::String)
                .placeholder("my-new-channel")
                .show_when("operation", &["create"]),
            NodeProperty::new("isPrivate", "Private Channel", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["create"]),
            // user:info
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .placeholder("U01234567")
                .show_when("operation", &["info"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "message".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Messages -----
            ("message", "send") => {
                let channel = ctx.param_str(params, "channel")?;
                let text = ctx.param_str_opt(params, "text").unwrap_or_default();
                let mut payload = Map::new();
                payload.insert("channel".into(), json!(channel));
                if !text.is_empty() {
                    payload.insert("text".into(), json!(text));
                }
                if let Some(blocks) = parse_json_param(ctx, params, "jsonBlocks") {
                    payload.insert("blocks".into(), blocks);
                }
                if let Some(attachments) = parse_json_param(ctx, params, "attachments") {
                    payload.insert("attachments".into(), attachments);
                }
                post_json(ctx, &token, "chat.postMessage", Value::Object(payload)).await?
            }
            ("message", "update") => {
                let channel = ctx.param_str(params, "channel")?;
                let ts = ctx.param_str(params, "messageTs")?;
                let text = ctx.param_str(params, "text")?;
                let payload = json!({
                    "channel": channel,
                    "ts": ts,
                    "text": text,
                });
                post_json(ctx, &token, "chat.update", payload).await?
            }
            ("message", "delete") => {
                let channel = ctx.param_str(params, "channel")?;
                let ts = ctx.param_str(params, "messageTs")?;
                let payload = json!({ "channel": channel, "ts": ts });
                post_json(ctx, &token, "chat.delete", payload).await?
            }
            ("message", "getHistory") => {
                let channel = ctx.param_str(params, "channel")?;
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let limit_str = limit.to_string();
                let query = vec![("channel", channel.as_str()), ("limit", limit_str.as_str())];
                get_with_query(ctx, &token, "conversations.history", &query).await?
            }
            // ----- Channels -----
            ("channel", "list") => get_with_query(ctx, &token, "conversations.list", &[]).await?,
            ("channel", "info") => {
                let channel = ctx.param_str(params, "channel")?;
                let query = vec![("channel", channel.as_str())];
                get_with_query(ctx, &token, "conversations.info", &query).await?
            }
            ("channel", "create") => {
                let name = ctx.param_str(params, "name")?;
                let is_private = ctx.param_bool(params, "isPrivate", false);
                let payload = json!({
                    "name": name,
                    "is_private": is_private,
                });
                post_json(ctx, &token, "conversations.create", payload).await?
            }
            // ----- Users -----
            ("user", "list") => get_with_query(ctx, &token, "users.list", &[]).await?,
            ("user", "info") => {
                let user_id = ctx.param_str(params, "userId")?;
                let query = vec![("user", user_id.as_str())];
                get_with_query(ctx, &token, "users.info", &query).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

/// POST a JSON payload to `{SLACK_API_BASE}/{endpoint}` with bearer auth and
/// validate Slack's `ok: true` convention.
async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{SLACK_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

/// GET `{SLACK_API_BASE}/{endpoint}` with bearer auth and optional query params.
async fn get_with_query(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    query: &[(&str, &str)],
) -> NodeResult<Value> {
    let url = format!("{SLACK_API_BASE}/{endpoint}");
    let mut req = ctx.http.get(&url).bearer_auth(token);
    if !query.is_empty() {
        req = req.query(query);
    }
    let res = req.send().await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    // Slack always returns 200 with an `ok` boolean — surface the error message
    // as an UpstreamError when `ok: false`.
    if body.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

/// Pull a JSON-shaped property out of `params`. Accepts either a native JSON
/// value (array/object) or a string holding JSON. Returns `None` if absent
/// or unparseable-but-empty.
fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
    }
}

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
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
