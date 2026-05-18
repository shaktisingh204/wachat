//! Pushover node — send push notifications via the Pushover Messages API
//! (`https://api.pushover.net/1/messages.json`).
//!
//! Credentials: `pushoverApi` with `apiToken` (the application/API token) and
//! `userKey` (the recipient's user or group key). Pushover takes both as form
//! fields in the POST body — there is no bearer header.

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

const PUSHOVER_API_BASE: &str = "https://api.pushover.net/1";

pub struct PushoverNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PushoverNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pushover",
            "Pushover",
            "Send push notifications via Pushover",
            NodeCategory::Communication,
        )
        .icon("smartphone")
        .color("#249DF1")
        .credentials(vec![CredentialBinding {
            name: "pushoverApi".into(),
            display_name: "Pushover API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Message", "sendMessage"),
                    opt("Validate User", "validateUser"),
                ])
                .default(json!("sendMessage"))
                .required(),
            // sendMessage
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .placeholder("Build #482 deployed successfully.")
                .show_when("operation", &["sendMessage"])
                .required(),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("priority", "Priority", NodePropertyType::Options)
                .options(vec![
                    opt("Lowest (-2)", "-2"),
                    opt("Low (-1)", "-1"),
                    opt("Normal (0)", "0"),
                    opt("High (1)", "1"),
                    opt("Emergency (2)", "2"),
                ])
                .default(json!("0"))
                .description("Pushover priority. Emergency (2) requires retry/expire.")
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("sound", "Sound", NodePropertyType::String)
                .placeholder("pushover")
                .description("Optional Pushover sound name (e.g. pushover, magic, cosmic).")
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("url", "Supplementary URL", NodePropertyType::String)
                .placeholder("https://example.com")
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("urlTitle", "URL Title", NodePropertyType::String)
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("device", "Device(s)", NodePropertyType::String)
                .placeholder("phone1,phone2")
                .description("Optional comma-separated device names; default sends to all.")
                .show_when("operation", &["sendMessage"]),
            // Emergency priority extras
            NodeProperty::new("retry", "Retry Interval (s)", NodePropertyType::Number)
                .default(60)
                .description("Required when priority=2. Minimum 30 seconds.")
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new("expire", "Expire After (s)", NodePropertyType::Number)
                .default(3600)
                .description("Required when priority=2. Maximum 10800 seconds.")
                .show_when("operation", &["sendMessage"]),
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
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();
        let user_key = cred
            .data
            .get("userKey")
            .ok_or_else(|| NodeError::MissingParameter("userKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;
        match operation.as_str() {
            "sendMessage" => {
                let message = ctx.param_str(params, "message")?;
                if message.trim().is_empty() {
                    return Err(NodeError::MissingParameter("message".into()));
                }

                let mut form: Vec<(&'static str, String)> = vec![
                    ("token", api_token.clone()),
                    ("user", user_key.clone()),
                    ("message", message),
                ];

                if let Some(title) =
                    ctx.param_str_opt(params, "title").filter(|s| !s.is_empty())
                {
                    form.push(("title", title));
                }
                if let Some(priority) =
                    ctx.param_str_opt(params, "priority").filter(|s| !s.is_empty())
                {
                    let is_emergency = priority == "2";
                    form.push(("priority", priority));
                    if is_emergency {
                        let retry = ctx.param_f64(params, "retry").unwrap_or(60.0) as i64;
                        let expire = ctx.param_f64(params, "expire").unwrap_or(3600.0) as i64;
                        form.push(("retry", retry.to_string()));
                        form.push(("expire", expire.to_string()));
                    }
                }
                if let Some(sound) =
                    ctx.param_str_opt(params, "sound").filter(|s| !s.is_empty())
                {
                    form.push(("sound", sound));
                }
                if let Some(url) =
                    ctx.param_str_opt(params, "url").filter(|s| !s.is_empty())
                {
                    form.push(("url", url));
                }
                if let Some(url_title) =
                    ctx.param_str_opt(params, "urlTitle").filter(|s| !s.is_empty())
                {
                    form.push(("url_title", url_title));
                }
                if let Some(device) =
                    ctx.param_str_opt(params, "device").filter(|s| !s.is_empty())
                {
                    form.push(("device", device));
                }

                let res = ctx
                    .http
                    .post(format!("{PUSHOVER_API_BASE}/messages.json"))
                    .form(&form)
                    .send()
                    .await?;
                finalize(res).await
            }
            "validateUser" => {
                let form: Vec<(&'static str, String)> =
                    vec![("token", api_token), ("user", user_key)];
                let res = ctx
                    .http
                    .post(format!("{PUSHOVER_API_BASE}/users/validate.json"))
                    .form(&form)
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
