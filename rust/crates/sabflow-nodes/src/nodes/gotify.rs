//! Gotify node — push messages to a self-hosted Gotify server (`/message`
//! endpoint of the Gotify REST API).
//!
//! Credentials: `gotifyApi` with two fields:
//!   - `baseUrl`     — Gotify server URL (e.g. `https://gotify.example.com`).
//!   - `appToken`    — Application token. Sent as `X-Gotify-Key` header
//!     (Gotify also accepts it as the `?token=` query param).
//!
//! The Gotify "message" endpoint requires an application token; the
//! "messages" / "applications" listing endpoints accept a client token, but
//! we accept the same field for both and let the server enforce permissions.

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

pub struct GotifyNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GotifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gotify",
            "Gotify",
            "Send push messages to a self-hosted Gotify server",
            NodeCategory::Communication,
        )
        .icon("send")
        .color("#39C0ED")
        .credentials(vec![CredentialBinding {
            name: "gotifyApi".into(),
            display_name: "Gotify API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Message", "sendMessage"),
                    opt("List Messages", "listMessages"),
                    opt("Delete Message", "deleteMessage"),
                ])
                .default(json!("sendMessage"))
                .required(),
            // sendMessage
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .placeholder("Deploy finished")
                .show_when("operation", &["sendMessage"])
                .required(),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("priority", "Priority", NodePropertyType::Number)
                .default(5)
                .description("Gotify priority (0-10). Higher = more intrusive on clients.")
                .show_when("operation", &["sendMessage"]),
            // listMessages
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(50)
                .description("Maximum messages to return.")
                .show_when("operation", &["listMessages"]),
            // deleteMessage
            NodeProperty::new("messageId", "Message ID", NodePropertyType::Number)
                .show_when("operation", &["deleteMessage"])
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
        let token = cred
            .data
            .get("appToken")
            .ok_or_else(|| NodeError::MissingParameter("appToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;
        match operation.as_str() {
            "sendMessage" => {
                let message = ctx.param_str(params, "message")?;
                if message.trim().is_empty() {
                    return Err(NodeError::MissingParameter("message".into()));
                }
                let mut payload = json!({ "message": message });
                if let Some(title) =
                    ctx.param_str_opt(params, "title").filter(|s| !s.is_empty())
                {
                    payload
                        .as_object_mut()
                        .expect("payload is an object")
                        .insert("title".into(), json!(title));
                }
                let priority = ctx.param_f64(params, "priority").unwrap_or(5.0) as i64;
                payload
                    .as_object_mut()
                    .expect("payload is an object")
                    .insert("priority".into(), json!(priority));

                let url = format!("{base_url}/message");
                let res = ctx
                    .http
                    .post(&url)
                    .header("X-Gotify-Key", &token)
                    .json(&payload)
                    .send()
                    .await?;
                finalize(res).await
            }
            "listMessages" => {
                let limit = ctx.param_f64(params, "limit").unwrap_or(50.0).max(1.0) as u32;
                let url = format!("{base_url}/message");
                let res = ctx
                    .http
                    .get(&url)
                    .header("X-Gotify-Key", &token)
                    .query(&[("limit", limit.to_string())])
                    .send()
                    .await?;
                finalize(res).await
            }
            "deleteMessage" => {
                let id = ctx
                    .param_f64(params, "messageId")
                    .ok_or_else(|| NodeError::MissingParameter("messageId".into()))?
                    as i64;
                let url = format!("{base_url}/message/{id}");
                let res = ctx
                    .http
                    .delete(&url)
                    .header("X-Gotify-Key", &token)
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
