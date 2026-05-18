//! Intercom node.
//!
//! Implements contact, conversation, and tag operations against the Intercom
//! REST API v2.10 (`https://api.intercom.io`). Authenticates with a Bearer
//! access token (a Personal Access Token from the Intercom developer hub).
//!
//! The `Intercom-Version` header is sent on every request so the schema is
//! pinned; users can override it via the credential `apiVersion` field.

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

pub struct IntercomNode;

const INTERCOM_BASE: &str = "https://api.intercom.io";
const DEFAULT_API_VERSION: &str = "2.10";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for IntercomNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "intercom",
            "Intercom",
            "Manage contacts, conversations, and tags via the Intercom API",
            NodeCategory::Communication,
        )
        .icon("message-circle")
        .color("#1F8DED")
        .credentials(vec![CredentialBinding {
            name: "intercomApi".into(),
            display_name: "Intercom API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Conversation", "conversation"),
                    opt("Tag", "tag"),
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
                    opt("Search by Email", "searchByEmail"),
                ])
                .default(json!("create"))
                .show_when("resource", &["contact"])
                .required(),
            // conversation ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Reply", "reply"),
                    opt("Close", "close"),
                ])
                .default(json!("create"))
                .show_when("resource", &["conversation"])
                .required(),
            // tag ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Create or Update", "createOrUpdate"),
                    opt("Tag Contact", "tagContact"),
                    opt("Untag Contact", "untagContact"),
                ])
                .default(json!("list"))
                .show_when("resource", &["tag"])
                .required(),
            // contact fields
            NodeProperty::new("role", "Role", NodePropertyType::Options)
                .options(vec![opt("User", "user"), opt("Lead", "lead")])
                .default(json!("user"))
                .show_when("operation", &["create"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["create", "update", "searchByEmail"]),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("externalId", "External ID", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Your application's user identifier"),
            NodeProperty::new("contactId", "Contact ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["get", "update", "delete", "create", "tagContact", "untagContact"],
                ),
            NodeProperty::new("customAttributes", "Custom Attributes", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description("JSON object of custom contact attributes"),
            // conversation fields
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::String)
                .show_when("operation", &["get", "reply", "close"]),
            NodeProperty::new("messageBody", "Message Body", NodePropertyType::String)
                .placeholder("Hello there!")
                .show_when("operation", &["create", "reply"])
                .description("HTML or plain-text message body"),
            NodeProperty::new("messageType", "Message Type", NodePropertyType::Options)
                .options(vec![opt("Comment", "comment"), opt("Note", "note")])
                .default(json!("comment"))
                .show_when("operation", &["reply"]),
            NodeProperty::new("adminId", "Admin ID", NodePropertyType::String)
                .show_when("operation", &["reply", "close"])
                .description("Admin (teammate) id sending the reply / closing the conversation"),
            // tag fields
            NodeProperty::new("tagName", "Tag Name", NodePropertyType::String)
                .show_when("operation", &["createOrUpdate"]),
            NodeProperty::new("tagId", "Tag ID", NodePropertyType::String)
                .show_when("operation", &["tagContact", "untagContact"]),
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
        let access_token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();
        let api_version = cred
            .data
            .get("apiVersion")
            .map(|s| s.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_API_VERSION)
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Contacts -----
            ("contact", "create") => {
                let mut payload = Map::new();
                let role = ctx
                    .param_str_opt(params, "role")
                    .unwrap_or_else(|| "user".to_string());
                payload.insert("role".into(), Value::String(role));
                add_optional_str(&mut payload, ctx, params, "email", "email");
                add_optional_str(&mut payload, ctx, params, "name", "name");
                add_optional_str(&mut payload, ctx, params, "externalId", "external_id");
                if let Some(attrs) = parse_json_param(ctx, params, "customAttributes") {
                    payload.insert("custom_attributes".into(), attrs);
                }
                let url = format!("{INTERCOM_BASE}/contacts");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(Value::Object(payload)))
                    .await?
            }
            ("contact", "get") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{INTERCOM_BASE}/contacts/{id}");
                send_request(ctx, &access_token, &api_version, Method::Get, &url, None).await?
            }
            ("contact", "update") => {
                let id = ctx.param_str(params, "contactId")?;
                let mut payload = Map::new();
                add_optional_str(&mut payload, ctx, params, "email", "email");
                add_optional_str(&mut payload, ctx, params, "name", "name");
                add_optional_str(&mut payload, ctx, params, "externalId", "external_id");
                if let Some(attrs) = parse_json_param(ctx, params, "customAttributes") {
                    payload.insert("custom_attributes".into(), attrs);
                }
                let url = format!("{INTERCOM_BASE}/contacts/{id}");
                send_request(ctx, &access_token, &api_version, Method::Put, &url, Some(Value::Object(payload)))
                    .await?
            }
            ("contact", "delete") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{INTERCOM_BASE}/contacts/{id}");
                send_request(ctx, &access_token, &api_version, Method::Delete, &url, None).await?
            }
            ("contact", "searchByEmail") => {
                let email = ctx.param_str(params, "email")?;
                let payload = json!({
                    "query": {
                        "field": "email",
                        "operator": "=",
                        "value": email,
                    }
                });
                let url = format!("{INTERCOM_BASE}/contacts/search");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            // ----- Conversations -----
            ("conversation", "create") => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let message_body = ctx.param_str(params, "messageBody")?;
                let payload = json!({
                    "from": { "type": "user", "id": contact_id },
                    "body": message_body,
                });
                let url = format!("{INTERCOM_BASE}/conversations");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            ("conversation", "get") => {
                let id = ctx.param_str(params, "conversationId")?;
                let url = format!("{INTERCOM_BASE}/conversations/{id}");
                send_request(ctx, &access_token, &api_version, Method::Get, &url, None).await?
            }
            ("conversation", "reply") => {
                let id = ctx.param_str(params, "conversationId")?;
                let admin_id = ctx.param_str(params, "adminId")?;
                let message_body = ctx.param_str(params, "messageBody")?;
                let message_type = ctx
                    .param_str_opt(params, "messageType")
                    .unwrap_or_else(|| "comment".to_string());
                let payload = json!({
                    "message_type": message_type,
                    "type": "admin",
                    "admin_id": admin_id,
                    "body": message_body,
                });
                let url = format!("{INTERCOM_BASE}/conversations/{id}/reply");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            ("conversation", "close") => {
                let id = ctx.param_str(params, "conversationId")?;
                let admin_id = ctx.param_str(params, "adminId")?;
                let payload = json!({
                    "message_type": "close",
                    "type": "admin",
                    "admin_id": admin_id,
                });
                let url = format!("{INTERCOM_BASE}/conversations/{id}/parts");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            // ----- Tags -----
            ("tag", "list") => {
                let url = format!("{INTERCOM_BASE}/tags");
                send_request(ctx, &access_token, &api_version, Method::Get, &url, None).await?
            }
            ("tag", "createOrUpdate") => {
                let name = ctx.param_str(params, "tagName")?;
                let payload = json!({ "name": name });
                let url = format!("{INTERCOM_BASE}/tags");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            ("tag", "tagContact") => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let tag_id = ctx.param_str(params, "tagId")?;
                let payload = json!({ "id": tag_id });
                let url = format!("{INTERCOM_BASE}/contacts/{contact_id}/tags");
                send_request(ctx, &access_token, &api_version, Method::Post, &url, Some(payload))
                    .await?
            }
            ("tag", "untagContact") => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let tag_id = ctx.param_str(params, "tagId")?;
                let url = format!("{INTERCOM_BASE}/contacts/{contact_id}/tags/{tag_id}");
                send_request(ctx, &access_token, &api_version, Method::Delete, &url, None).await?
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

fn add_optional_str(
    payload: &mut Map<String, Value>,
    ctx: &ExecutionContext,
    params: &Value,
    src: &str,
    dst: &str,
) {
    if let Some(v) = ctx.param_str_opt(params, src) {
        if !v.trim().is_empty() {
            payload.insert(dst.into(), Value::String(v));
        }
    }
}

#[derive(Clone, Copy)]
enum Method {
    Get,
    Post,
    Put,
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    access_token: &str,
    api_version: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Get => ctx.http.get(url),
        Method::Post => ctx.http.post(url),
        Method::Put => ctx.http.put(url),
        Method::Delete => ctx.http.delete(url),
    };
    req = req
        .bearer_auth(access_token)
        .header("Intercom-Version", api_version)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json");
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
