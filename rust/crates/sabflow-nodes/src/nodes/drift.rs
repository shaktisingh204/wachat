//! Drift node.
//!
//! Implements contact and conversation operations against the Drift API
//! (`https://driftapi.com`). Authenticates with a Bearer access token.

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

pub struct DriftNode;

const DRIFT_BASE: &str = "https://driftapi.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for DriftNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "drift",
            "Drift",
            "Manage contacts and conversations via the Drift conversational marketing API",
            NodeCategory::Marketing,
        )
        .icon("message-circle")
        .color("#1657FB")
        .credentials(vec![CredentialBinding {
            name: "driftApi".into(),
            display_name: "Drift API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Conversation", "conversation"),
                ])
                .default(json!("contact"))
                .required(),
            // contact ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["contact"])
                .required(),
            // conversation ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Send Message", "sendMessage"),
                    opt("List Messages", "listMessages"),
                ])
                .default(json!("get"))
                .show_when("resource", &["conversation"])
                .required(),
            // contact fields
            NodeProperty::new("contactId", "Contact ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("attributes", "Attributes", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description("JSON object of Drift contact attributes"),
            // conversation fields
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["get", "sendMessage", "listMessages"],
                ),
            NodeProperty::new("body", "Message Body", NodePropertyType::String)
                .show_when("operation", &["sendMessage"])
                .required(),
            NodeProperty::new("messageType", "Message Type", NodePropertyType::Options)
                .options(vec![
                    opt("Chat", "chat"),
                    opt("Private Note", "private_note"),
                    opt("Private Prompt", "private_prompt"),
                ])
                .default(json!("chat"))
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Contacts -----
            ("contact", "create") => {
                let attributes = build_contact_attributes(ctx, params);
                let payload = json!({ "attributes": attributes });
                let url = format!("{DRIFT_BASE}/contacts");
                send_request(ctx, &token, Method::Post, &url, Some(payload)).await?
            }
            ("contact", "get") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{DRIFT_BASE}/contacts/{id}");
                send_request(ctx, &token, Method::Get, &url, None).await?
            }
            ("contact", "update") => {
                let id = ctx.param_str(params, "contactId")?;
                let attributes = build_contact_attributes(ctx, params);
                let payload = json!({ "attributes": attributes });
                let url = format!("{DRIFT_BASE}/contacts/{id}");
                send_request(ctx, &token, Method::Patch, &url, Some(payload)).await?
            }
            ("contact", "delete") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{DRIFT_BASE}/contacts/{id}");
                send_request(ctx, &token, Method::Delete, &url, None).await?
            }
            // ----- Conversations -----
            ("conversation", "get") => {
                let id = ctx.param_str(params, "conversationId")?;
                let url = format!("{DRIFT_BASE}/conversations/{id}");
                send_request(ctx, &token, Method::Get, &url, None).await?
            }
            ("conversation", "sendMessage") => {
                let id = ctx.param_str(params, "conversationId")?;
                let message = ctx.param_str(params, "body")?;
                let message_type = ctx
                    .param_str_opt(params, "messageType")
                    .unwrap_or_else(|| "chat".to_string());
                let payload = json!({
                    "body": message,
                    "type": message_type,
                });
                let url = format!("{DRIFT_BASE}/conversations/{id}/messages");
                send_request(ctx, &token, Method::Post, &url, Some(payload)).await?
            }
            ("conversation", "listMessages") => {
                let id = ctx.param_str(params, "conversationId")?;
                let url = format!("{DRIFT_BASE}/conversations/{id}/messages");
                send_request(ctx, &token, Method::Get, &url, None).await?
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

fn build_contact_attributes(ctx: &ExecutionContext, params: &Value) -> Value {
    let mut attrs = match parse_json_param(ctx, params, "attributes") {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    if let Some(email) = ctx.param_str_opt(params, "email") {
        if !email.trim().is_empty() {
            attrs.insert("email".into(), Value::String(email));
        }
    }
    Value::Object(attrs)
}

#[derive(Clone, Copy)]
enum Method {
    Get,
    Post,
    Patch,
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    token: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Get => ctx.http.get(url),
        Method::Post => ctx.http.post(url),
        Method::Patch => ctx.http.patch(url),
        Method::Delete => ctx.http.delete(url),
    };
    req = req
        .bearer_auth(token)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json");
    if let Some(body) = payload {
        req = req.json(&body);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
}

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

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(
            arr.into_iter()
                .map(|x| substitute_value(ctx, x))
                .collect(),
        ),
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
