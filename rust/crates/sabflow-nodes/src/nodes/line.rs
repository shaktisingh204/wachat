//! LINE Messaging API node.
//!
//! Sends text messages and queries the bot account against the LINE
//! Messaging API (https://api.line.me/v2/bot). Authenticates with a long-lived
//! channel access token supplied via the `lineApi` credential
//! (`channelAccessToken` field) using bearer auth.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

const LINE_API_BASE: &str = "https://api.line.me/v2/bot";

pub struct LineNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for LineNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "line",
            "LINE",
            "Send LINE messages and query the LINE Messaging API",
            NodeCategory::Communication,
        )
        .icon("message-circle")
        .color("#00C300")
        .credentials(vec![CredentialBinding {
            name: "lineApi".into(),
            display_name: "LINE Messaging API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Push Message", "pushMessage"),
                    opt("Multicast Message", "multicastMessage"),
                    opt("Broadcast", "broadcast"),
                    opt("Get Profile", "getProfile"),
                    opt("Get Quota", "getQuota"),
                ])
                .default(json!("pushMessage"))
                .required(),
            // pushMessage
            NodeProperty::new("to", "To (User ID)", NodePropertyType::String)
                .placeholder("U1234567890abcdef1234567890abcdef")
                .description("LINE user, group, or room ID to send the message to")
                .show_when("operation", &["pushMessage"])
                .required(),
            // multicastMessage
            NodeProperty::new("toList", "To (User IDs, JSON array)", NodePropertyType::Json)
                .placeholder(r#"["U1...","U2..."]"#)
                .description("JSON array of LINE user IDs (max 500)")
                .show_when("operation", &["multicastMessage"])
                .required(),
            // text — shared by push/multicast/broadcast
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when(
                    "operation",
                    &["pushMessage", "multicastMessage", "broadcast"],
                )
                .required(),
            // getProfile
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .placeholder("U1234567890abcdef1234567890abcdef")
                .show_when("operation", &["getProfile"])
                .required(),
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
            .get("channelAccessToken")
            .ok_or_else(|| NodeError::MissingParameter("channelAccessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "pushMessage" => {
                let to = ctx.param_str(params, "to")?;
                let text = ctx.param_str(params, "text")?;
                let payload = json!({
                    "to": to,
                    "messages": [{ "type": "text", "text": text }],
                });
                post_json(ctx, &token, "/message/push", payload).await?
            }
            "multicastMessage" => {
                let to = parse_to_array(ctx, params)?;
                let text = ctx.param_str(params, "text")?;
                let payload = json!({
                    "to": to,
                    "messages": [{ "type": "text", "text": text }],
                });
                post_json(ctx, &token, "/message/multicast", payload).await?
            }
            "broadcast" => {
                let text = ctx.param_str(params, "text")?;
                let payload = json!({
                    "messages": [{ "type": "text", "text": text }],
                });
                post_json(ctx, &token, "/message/broadcast", payload).await?
            }
            "getProfile" => {
                let user_id = ctx.param_str(params, "userId")?;
                let path = format!("/profile/{user_id}");
                get_json(ctx, &token, &path).await?
            }
            "getQuota" => get_json(ctx, &token, "/message/quota").await?,
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

/// Resolve the `toList` property into a JSON array of user IDs. Accepts either
/// a native JSON array or a string containing a JSON array.
fn parse_to_array(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let raw = params
        .get("toList")
        .ok_or_else(|| NodeError::MissingParameter("toList".into()))?;
    let parsed = match raw {
        Value::Array(_) => raw.clone(),
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Err(NodeError::MissingParameter("toList".into()));
            }
            serde_json::from_str::<Value>(trimmed).map_err(|e| NodeError::InvalidParameter {
                name: "toList".into(),
                reason: format!("expected JSON array of user IDs: {e}"),
            })?
        }
        _ => {
            return Err(NodeError::InvalidParameter {
                name: "toList".into(),
                reason: "expected JSON array of user IDs".into(),
            });
        }
    };
    if !parsed.is_array() {
        return Err(NodeError::InvalidParameter {
            name: "toList".into(),
            reason: "expected JSON array of user IDs".into(),
        });
    }
    Ok(parsed)
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{LINE_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(ctx: &ExecutionContext, token: &str, path: &str) -> NodeResult<Value> {
    let url = format!("{LINE_API_BASE}{path}");
    let res = ctx.http.get(&url).bearer_auth(token).send().await?;
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
    Ok(body)
}
