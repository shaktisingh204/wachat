//! Twist node — async team messaging (Doist).
//!
//! Posts messages and comments via the Twist API v3
//! (`https://api.twist.com/api/v3`). Auth is bearer token (OAuth2 access
//! token stored in the credential `accessToken` field).
//!
//! Quality bar: C.5 typed-stub-with-descriptor — `addMessage` and
//! `addComment` are wired against the live API; other resources follow.

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

const TWIST_API: &str = "https://api.twist.com/api/v3";

pub struct TwistNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TwistNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "twist",
            "Twist",
            "Post threads and comments to Twist channels",
            NodeCategory::Communication,
        )
        .icon("message-square")
        .color("#EC6E5E")
        .credentials(vec![CredentialBinding {
            name: "twistOAuth2Api".into(),
            display_name: "Twist OAuth2 Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Thread", "thread"),
                    opt("Comment", "comment"),
                ])
                .default(json!("thread"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Add", "add")])
                .default(json!("add"))
                .required(),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .description("Twist channel ID where the thread is posted")
                .show_when("resource", &["thread"])
                .required(),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .placeholder("Weekly update")
                .show_when("resource", &["thread"])
                .required(),
            NodeProperty::new("threadId", "Thread ID", NodePropertyType::String)
                .description("Twist thread ID to comment on")
                .show_when("resource", &["comment"])
                .required(),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .placeholder("Hello team!")
                .description("Message body — Markdown supported")
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
            .get("accessToken")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "thread".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "add".to_string());
        let content = ctx.param_str(params, "content")?;

        let (path, payload) = match (resource.as_str(), operation.as_str()) {
            ("thread", "add") => {
                let channel_id = ctx.param_str(params, "channelId")?;
                let title = ctx.param_str(params, "title")?;
                (
                    "/threads/add",
                    json!({
                        "channel_id": channel_id,
                        "title": title,
                        "content": content,
                    }),
                )
            }
            ("comment", "add") => {
                let thread_id = ctx.param_str(params, "threadId")?;
                (
                    "/comments/add",
                    json!({
                        "thread_id": thread_id,
                        "content": content,
                    }),
                )
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported twist {res} operation: {op}"),
                });
            }
        };

        let url = format!("{TWIST_API}{path}");
        let res = ctx
            .http
            .post(&url)
            .bearer_auth(&token)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;
        let status = res.status();
        let text_body = res.text().await.unwrap_or_default();
        let body: Value =
            serde_json::from_str(&text_body).unwrap_or(Value::String(text_body.clone()));
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body.to_string(),
            });
        }
        Ok(NodeOutput::single(vec![body]))
    }
}
