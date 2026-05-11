//! Brevo (formerly Sendinblue) node.
//!
//! Implements contact, list, transactional email, and transactional SMS
//! operations against the Brevo REST API v3.
//!
//! Auth: header `api-key: {apiKey}` plus `Content-Type: application/json`.
//! Base URL: `https://api.brevo.com/v3`.

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

pub struct BrevoNode;

const BASE_URL: &str = "https://api.brevo.com/v3";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for BrevoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "brevo",
            "Brevo",
            "Email and SMS marketing via Brevo (formerly Sendinblue)",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#00B4FF")
        .credentials(vec![CredentialBinding {
            name: "brevoApi".into(),
            display_name: "Brevo API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("List", "list"),
                    opt("Email", "email"),
                    opt("SMS", "sms"),
                ])
                .default(json!("contact"))
                .required(),
            // ----- contact operations -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("List", "list"),
                    opt("Add to List", "addToList"),
                    opt("Remove from List", "removeFromList"),
                ])
                .default(json!("create"))
                .show_when("resource", &["contact"])
                .required(),
            // ----- list operations -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["list"])
                .required(),
            // ----- email operations -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send", "send")])
                .default(json!("send"))
                .show_when("resource", &["email"])
                .required(),
            // ----- sms operations -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send", "send")])
                .default(json!("send"))
                .show_when("resource", &["sms"])
                .required(),
            // ----- contact fields -----
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["create"])
                .description("Email address of the contact"),
            NodeProperty::new(
                "identifier",
                "Identifier (Email or ID)",
                NodePropertyType::String,
            )
            .placeholder("user@example.com")
            .show_when("operation", &["get", "update", "delete"])
            .description("Email address or contact ID"),
            NodeProperty::new("attributes", "Attributes", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description(
                    "JSON object of attribute values, e.g. {\"FIRSTNAME\":\"Jane\",\"LASTNAME\":\"Doe\"}",
                ),
            // ----- list fields -----
            NodeProperty::new("listName", "List Name", NodePropertyType::String)
                .show_when("resource", &["list"])
                .description("Name of the list (used for create)"),
            NodeProperty::new("folderId", "Folder ID", NodePropertyType::Number)
                .show_when("resource", &["list"])
                .description("Folder ID where the list will be created"),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .description("Identifier of the Brevo contact list"),
            // ----- email fields -----
            NodeProperty::new("senderEmail", "Sender Email", NodePropertyType::String)
                .placeholder("hello@example.com")
                .show_when("resource", &["email"]),
            NodeProperty::new("senderName", "Sender Name", NodePropertyType::String)
                .show_when("resource", &["email"]),
            NodeProperty::new("toEmail", "To Email", NodePropertyType::String)
                .placeholder("recipient@example.com")
                .show_when("resource", &["email"]),
            NodeProperty::new("toName", "To Name", NodePropertyType::String)
                .show_when("resource", &["email"]),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("resource", &["email"]),
            NodeProperty::new("htmlContent", "HTML Content", NodePropertyType::String)
                .show_when("resource", &["email"])
                .description("HTML body of the email (omit when using templateId)"),
            NodeProperty::new("templateId", "Template ID", NodePropertyType::Number)
                .show_when("resource", &["email"])
                .description("Brevo email template id (omit to send htmlContent directly)"),
            NodeProperty::new("templateParams", "Template Params", NodePropertyType::Json)
                .show_when("resource", &["email"])
                .description("JSON object of params merged into the template"),
            // ----- sms fields -----
            NodeProperty::new("smsSender", "Sender", NodePropertyType::String)
                .placeholder("MyBrand")
                .show_when("resource", &["sms"])
                .description("Sender name (max 11 chars)"),
            NodeProperty::new("smsRecipient", "Recipient", NodePropertyType::String)
                .placeholder("+15551234567")
                .show_when("resource", &["sms"])
                .description("Recipient phone number in E.164 format"),
            NodeProperty::new("smsContent", "Content", NodePropertyType::String)
                .show_when("resource", &["sms"]),
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Contact -----
            ("contact", "create") => {
                let email = ctx.param_str(params, "email")?;
                let mut payload = Map::new();
                payload.insert("email".into(), json!(email));
                if let Some(attrs) = parse_json_param(ctx, params, "attributes") {
                    payload.insert("attributes".into(), attrs);
                }
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/contacts"),
                    Some(Value::Object(payload)),
                )
                .await?
            }
            ("contact", "get") => {
                let identifier = ctx.param_str(params, "identifier")?;
                let encoded = urlencode(&identifier);
                send_request(
                    ctx,
                    &api_key,
                    Method::Get,
                    &format!("{BASE_URL}/contacts/{encoded}"),
                    None,
                )
                .await?
            }
            ("contact", "update") => {
                let identifier = ctx.param_str(params, "identifier")?;
                let encoded = urlencode(&identifier);
                let mut payload = Map::new();
                if let Some(attrs) = parse_json_param(ctx, params, "attributes") {
                    payload.insert("attributes".into(), attrs);
                }
                send_request(
                    ctx,
                    &api_key,
                    Method::Put,
                    &format!("{BASE_URL}/contacts/{encoded}"),
                    Some(Value::Object(payload)),
                )
                .await?
            }
            ("contact", "delete") => {
                let identifier = ctx.param_str(params, "identifier")?;
                let encoded = urlencode(&identifier);
                send_request(
                    ctx,
                    &api_key,
                    Method::Delete,
                    &format!("{BASE_URL}/contacts/{encoded}"),
                    None,
                )
                .await?
            }
            ("contact", "list") => {
                send_request(
                    ctx,
                    &api_key,
                    Method::Get,
                    &format!("{BASE_URL}/contacts"),
                    None,
                )
                .await?
            }
            ("contact", "addToList") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email").or_else(|_| {
                    ctx.param_str(params, "identifier")
                })?;
                let payload = json!({ "emails": [email] });
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/contacts/lists/{list_id}/contacts/add"),
                    Some(payload),
                )
                .await?
            }
            ("contact", "removeFromList") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email").or_else(|_| {
                    ctx.param_str(params, "identifier")
                })?;
                let payload = json!({ "emails": [email] });
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/contacts/lists/{list_id}/contacts/remove"),
                    Some(payload),
                )
                .await?
            }
            // ----- List -----
            ("list", "create") => {
                let name = ctx.param_str(params, "listName")?;
                let folder_id = ctx.param_f64(params, "folderId").ok_or_else(|| {
                    NodeError::MissingParameter("folderId".into())
                })?;
                let payload = json!({
                    "name": name,
                    "folderId": folder_id as i64,
                });
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/contacts/lists"),
                    Some(payload),
                )
                .await?
            }
            ("list", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                send_request(
                    ctx,
                    &api_key,
                    Method::Get,
                    &format!("{BASE_URL}/contacts/lists/{list_id}"),
                    None,
                )
                .await?
            }
            ("list", "list") => {
                send_request(
                    ctx,
                    &api_key,
                    Method::Get,
                    &format!("{BASE_URL}/contacts/lists"),
                    None,
                )
                .await?
            }
            ("list", "delete") => {
                let list_id = ctx.param_str(params, "listId")?;
                send_request(
                    ctx,
                    &api_key,
                    Method::Delete,
                    &format!("{BASE_URL}/contacts/lists/{list_id}"),
                    None,
                )
                .await?
            }
            // ----- Email -----
            ("email", "send") => {
                let sender_email = ctx.param_str(params, "senderEmail")?;
                let sender_name = ctx.param_str_opt(params, "senderName");
                let to_email = ctx.param_str(params, "toEmail")?;
                let to_name = ctx.param_str_opt(params, "toName");

                let mut sender = Map::new();
                sender.insert("email".into(), json!(sender_email));
                if let Some(n) = sender_name.filter(|s| !s.is_empty()) {
                    sender.insert("name".into(), json!(n));
                }

                let mut to_entry = Map::new();
                to_entry.insert("email".into(), json!(to_email));
                if let Some(n) = to_name.filter(|s| !s.is_empty()) {
                    to_entry.insert("name".into(), json!(n));
                }

                let mut payload = Map::new();
                payload.insert("sender".into(), Value::Object(sender));
                payload.insert("to".into(), Value::Array(vec![Value::Object(to_entry)]));

                if let Some(subject) = ctx
                    .param_str_opt(params, "subject")
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("subject".into(), json!(subject));
                }

                let template_id = ctx.param_f64(params, "templateId");
                let html_content = ctx
                    .param_str_opt(params, "htmlContent")
                    .filter(|s| !s.is_empty());

                match (template_id, html_content) {
                    (Some(tid), _) => {
                        payload.insert("templateId".into(), json!(tid as i64));
                    }
                    (None, Some(html)) => {
                        payload.insert("htmlContent".into(), json!(html));
                    }
                    (None, None) => {
                        return Err(NodeError::MissingParameter(
                            "htmlContent or templateId".into(),
                        ));
                    }
                }

                if let Some(params_val) = parse_json_param(ctx, params, "templateParams") {
                    payload.insert("params".into(), params_val);
                }

                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/smtp/email"),
                    Some(Value::Object(payload)),
                )
                .await?
            }
            // ----- SMS -----
            ("sms", "send") => {
                let sender = ctx.param_str(params, "smsSender")?;
                let recipient = ctx.param_str(params, "smsRecipient")?;
                let content = ctx.param_str(params, "smsContent")?;
                let payload = json!({
                    "sender": sender,
                    "recipient": recipient,
                    "content": content,
                });
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &format!("{BASE_URL}/transactionalSMS/sms"),
                    Some(payload),
                )
                .await?
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

#[derive(Clone, Copy)]
enum Method {
    Get,
    Post,
    Put,
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    api_key: &str,
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
        .header("api-key", api_key)
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

/// Minimal path-segment percent encoder for emails and identifiers.
/// Encodes anything outside the unreserved set so values like
/// `user+tag@example.com` round-trip correctly.
fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.as_bytes() {
        let c = *byte;
        let unreserved = c.is_ascii_alphanumeric()
            || c == b'-'
            || c == b'_'
            || c == b'.'
            || c == b'~';
        if unreserved {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{c:02X}"));
        }
    }
    out
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
