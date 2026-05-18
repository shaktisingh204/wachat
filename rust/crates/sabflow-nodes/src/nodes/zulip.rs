//! Zulip node — send stream and private messages, and query subscriptions on
//! a Zulip server through its REST API (`{baseUrl}/api/v1/...`).
//!
//! Credentials: `zulipApi` with `baseUrl`, `email`, and `apiKey`. Zulip uses
//! HTTP Basic auth where the username is the user's email and the password is
//! the API key.

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

pub struct ZulipNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ZulipNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zulip",
            "Zulip",
            "Send messages and query subscriptions on a Zulip server",
            NodeCategory::Communication,
        )
        .icon("message-square")
        .color("#52C2AF")
        .credentials(vec![CredentialBinding {
            name: "zulipApi".into(),
            display_name: "Zulip API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Stream Message", "sendStreamMessage"),
                    opt("Send Private Message", "sendPrivateMessage"),
                    opt("Update Message", "updateMessage"),
                    opt("Delete Message", "deleteMessage"),
                    opt("List Subscriptions", "listSubscriptions"),
                ])
                .default(json!("sendStreamMessage"))
                .required(),
            // sendStreamMessage
            NodeProperty::new("stream", "Stream", NodePropertyType::String)
                .placeholder("general")
                .show_when("operation", &["sendStreamMessage"])
                .required(),
            NodeProperty::new("topic", "Topic", NodePropertyType::String)
                .placeholder("deployments")
                .show_when("operation", &["sendStreamMessage"])
                .required(),
            // sendPrivateMessage
            NodeProperty::new("recipients", "Recipients", NodePropertyType::String)
                .placeholder("alice@example.com,bob@example.com")
                .description("Comma-separated email addresses or user IDs.")
                .show_when("operation", &["sendPrivateMessage"])
                .required(),
            // Shared content
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when(
                    "operation",
                    &["sendStreamMessage", "sendPrivateMessage", "updateMessage"],
                )
                .required(),
            // update / delete
            NodeProperty::new("messageId", "Message ID", NodePropertyType::Number)
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
        let email = cred
            .data
            .get("email")
            .ok_or_else(|| NodeError::MissingParameter("email".into()))?
            .clone();
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let base = format!("{base_url}/api/v1");
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "sendStreamMessage" => {
                let stream = ctx.param_str(params, "stream")?;
                let topic = ctx.param_str(params, "topic")?;
                let content = ctx.param_str(params, "content")?;
                if stream.trim().is_empty() {
                    return Err(NodeError::MissingParameter("stream".into()));
                }
                if topic.trim().is_empty() {
                    return Err(NodeError::MissingParameter("topic".into()));
                }
                let form: Vec<(&'static str, String)> = vec![
                    ("type", "stream".into()),
                    ("to", stream),
                    ("topic", topic),
                    ("content", content),
                ];
                let res = ctx
                    .http
                    .post(format!("{base}/messages"))
                    .basic_auth(&email, Some(&api_key))
                    .form(&form)
                    .send()
                    .await?;
                finalize(res).await
            }
            "sendPrivateMessage" => {
                let recipients_raw = ctx.param_str(params, "recipients")?;
                let recipients: Vec<String> = recipients_raw
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if recipients.is_empty() {
                    return Err(NodeError::MissingParameter("recipients".into()));
                }
                let content = ctx.param_str(params, "content")?;
                // Zulip accepts a JSON-encoded array for the `to` field when
                // sending private messages.
                let to_json = serde_json::to_string(&recipients).unwrap_or_else(|_| "[]".into());
                let form: Vec<(&'static str, String)> = vec![
                    ("type", "private".into()),
                    ("to", to_json),
                    ("content", content),
                ];
                let res = ctx
                    .http
                    .post(format!("{base}/messages"))
                    .basic_auth(&email, Some(&api_key))
                    .form(&form)
                    .send()
                    .await?;
                finalize(res).await
            }
            "updateMessage" => {
                let id = ctx
                    .param_f64(params, "messageId")
                    .ok_or_else(|| NodeError::MissingParameter("messageId".into()))?
                    as i64;
                let content = ctx.param_str(params, "content")?;
                let form: Vec<(&'static str, String)> = vec![("content", content)];
                let url = format!("{base}/messages/{id}");
                let res = ctx
                    .http
                    .patch(&url)
                    .basic_auth(&email, Some(&api_key))
                    .form(&form)
                    .send()
                    .await?;
                finalize(res).await
            }
            "deleteMessage" => {
                let id = ctx
                    .param_f64(params, "messageId")
                    .ok_or_else(|| NodeError::MissingParameter("messageId".into()))?
                    as i64;
                let url = format!("{base}/messages/{id}");
                let res = ctx
                    .http
                    .delete(&url)
                    .basic_auth(&email, Some(&api_key))
                    .send()
                    .await?;
                finalize(res).await
            }
            "listSubscriptions" => {
                let url = format!("{base}/users/me/subscriptions");
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&email, Some(&api_key))
                    .send()
                    .await?;
                finalize(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body_value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        let body_str = match &body_value {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_str,
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}
