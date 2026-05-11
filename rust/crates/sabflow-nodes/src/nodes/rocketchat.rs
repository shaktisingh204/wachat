//! Rocket.Chat node.
//!
//! Implements message and discovery operations against a self-hosted or
//! cloud Rocket.Chat server's REST API (`/api/v1/...`). Authenticates using
//! the user-scoped `X-User-Id` / `X-Auth-Token` header pair supplied via the
//! `rocketChatApi` credential.

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

pub struct RocketChatNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for RocketChatNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rocketchat",
            "Rocket.Chat",
            "Send messages and query channels/users on Rocket.Chat",
            NodeCategory::Communication,
        )
        .icon("rocket")
        .color("#F5455C")
        .credentials(vec![CredentialBinding {
            name: "rocketChatApi".into(),
            display_name: "Rocket.Chat API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Post Message", "postMessage"),
                    opt("Update Message", "updateMessage"),
                    opt("Delete Message", "deleteMessage"),
                    opt("List Channels", "listChannels"),
                    opt("List Users", "listUsers"),
                ])
                .default(json!("postMessage"))
                .required(),
            // postMessage
            NodeProperty::new("channel", "Channel", NodePropertyType::String)
                .placeholder("#general or @username or roomId")
                .show_when("operation", &["postMessage"])
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when("operation", &["postMessage", "updateMessage"])
                .required(),
            // updateMessage / deleteMessage
            NodeProperty::new("roomId", "Room ID", NodePropertyType::String)
                .placeholder("GENERAL")
                .show_when("operation", &["updateMessage", "deleteMessage"])
                .required(),
            NodeProperty::new("msgId", "Message ID", NodePropertyType::String)
                .placeholder("7aDSXtjMA3KPLxLjt")
                .show_when("operation", &["updateMessage", "deleteMessage"])
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

        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let user_id = cred
            .data
            .get("userId")
            .ok_or_else(|| NodeError::MissingParameter("userId".into()))?
            .clone();
        let auth_token = cred
            .data
            .get("authToken")
            .ok_or_else(|| NodeError::MissingParameter("authToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "postMessage" => {
                let channel = ctx.param_str(params, "channel")?;
                let text = ctx.param_str(params, "text")?;
                let payload = json!({ "channel": channel, "text": text });
                post_json(
                    ctx,
                    &base_url,
                    &user_id,
                    &auth_token,
                    "/api/v1/chat.postMessage",
                    payload,
                )
                .await?
            }
            "updateMessage" => {
                let room_id = ctx.param_str(params, "roomId")?;
                let msg_id = ctx.param_str(params, "msgId")?;
                let text = ctx.param_str(params, "text")?;
                let payload = json!({
                    "roomId": room_id,
                    "msgId": msg_id,
                    "text": text,
                });
                post_json(
                    ctx,
                    &base_url,
                    &user_id,
                    &auth_token,
                    "/api/v1/chat.update",
                    payload,
                )
                .await?
            }
            "deleteMessage" => {
                let room_id = ctx.param_str(params, "roomId")?;
                let msg_id = ctx.param_str(params, "msgId")?;
                let payload = json!({ "roomId": room_id, "msgId": msg_id });
                post_json(
                    ctx,
                    &base_url,
                    &user_id,
                    &auth_token,
                    "/api/v1/chat.delete",
                    payload,
                )
                .await?
            }
            "listChannels" => {
                get_json(
                    ctx,
                    &base_url,
                    &user_id,
                    &auth_token,
                    "/api/v1/channels.list",
                )
                .await?
            }
            "listUsers" => {
                get_json(
                    ctx,
                    &base_url,
                    &user_id,
                    &auth_token,
                    "/api/v1/users.list",
                )
                .await?
            }
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

async fn post_json(
    ctx: &ExecutionContext,
    base_url: &str,
    user_id: &str,
    auth_token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base_url}{path}");
    let res = ctx
        .http
        .post(&url)
        .header("X-User-Id", user_id)
        .header("X-Auth-Token", auth_token)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(
    ctx: &ExecutionContext,
    base_url: &str,
    user_id: &str,
    auth_token: &str,
    path: &str,
) -> NodeResult<Value> {
    let url = format!("{base_url}{path}");
    let res = ctx
        .http
        .get(&url)
        .header("X-User-Id", user_id)
        .header("X-Auth-Token", auth_token)
        .send()
        .await?;
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
