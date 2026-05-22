//! SendGrid node.
//!
//! Implements transactional mail, contact (marketing), and list operations
//! against the SendGrid v3 API (https://api.sendgrid.com/v3). Authenticates
//! with an API key supplied via the `sendGridApi` credential (`apiKey` field).

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

pub struct SendGridNode;

const SENDGRID_API_BASE: &str = "https://api.sendgrid.com/v3";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SendGridNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sendGrid",
            "SendGrid",
            "Send transactional email and manage marketing contacts via SendGrid",
            NodeCategory::Communication,
        )
        .icon("mail")
        .color("#1A82E2")
        .credentials(vec![CredentialBinding {
            name: "sendGridApi".into(),
            display_name: "SendGrid API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Mail", "mail"),
                    opt("Contact", "contact"),
                    opt("List", "list"),
                ])
                .default(json!("mail"))
                .required(),
            // mail operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send", "send")])
                .default(json!("send"))
                .show_when("resource", &["mail"])
                .required(),
            // contact operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Add or Update", "addOrUpdate"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Delete", "delete"),
                ])
                .default(json!("addOrUpdate"))
                .show_when("resource", &["contact"])
                .required(),
            // list operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["list"])
                .required(),
            // mail:send fields
            NodeProperty::new("fromEmail", "From Email", NodePropertyType::String)
                .placeholder("noreply@example.com")
                .show_when("operation", &["send"]),
            NodeProperty::new("fromName", "From Name", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new("toEmail", "To Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["send"]),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new("contentType", "Content Type", NodePropertyType::Options)
                .options(vec![
                    opt("HTML", "text/html"),
                    opt("Plain Text", "text/plain"),
                ])
                .default(json!("text/html"))
                .show_when("operation", &["send"]),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .show_when("operation", &["send"]),
            // contact fields
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["addOrUpdate", "get", "delete"]),
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("operation", &["addOrUpdate"]),
            NodeProperty::new("lastName", "Last Name", NodePropertyType::String)
                .show_when("operation", &["addOrUpdate"]),
            NodeProperty::new("contactId", "Contact ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete"])
                .description(
                    "SendGrid contact id (resolved by get/delete on the contact resource)",
                ),
            // list fields
            NodeProperty::new("listName", "List Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete"])
                .description("SendGrid list id"),
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
            .unwrap_or_else(|| "mail".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Mail -----
            ("mail", "send") => {
                let from_email = ctx.param_str(params, "fromEmail")?;
                let from_name = ctx.param_str_opt(params, "fromName").unwrap_or_default();
                let to_email = ctx.param_str(params, "toEmail")?;
                let subject = ctx.param_str(params, "subject")?;
                let content_type = ctx
                    .param_str_opt(params, "contentType")
                    .unwrap_or_else(|| "text/html".to_string());
                let content = ctx.param_str(params, "content")?;

                let mut from_obj = Map::new();
                from_obj.insert("email".into(), json!(from_email));
                if !from_name.is_empty() {
                    from_obj.insert("name".into(), json!(from_name));
                }
                let payload = json!({
                    "personalizations": [{
                        "to": [{ "email": to_email }],
                    }],
                    "from": Value::Object(from_obj),
                    "subject": subject,
                    "content": [{
                        "type": content_type,
                        "value": content,
                    }],
                });
                send_request(ctx, &api_key, Method::Post, "/mail/send", Some(payload)).await?
            }
            // ----- Contacts -----
            ("contact", "addOrUpdate") => {
                let email = ctx.param_str(params, "email")?;
                let first_name = ctx.param_str_opt(params, "firstName").unwrap_or_default();
                let last_name = ctx.param_str_opt(params, "lastName").unwrap_or_default();
                let mut contact = Map::new();
                contact.insert("email".into(), json!(email));
                if !first_name.is_empty() {
                    contact.insert("first_name".into(), json!(first_name));
                }
                if !last_name.is_empty() {
                    contact.insert("last_name".into(), json!(last_name));
                }
                let payload = json!({
                    "contacts": [Value::Object(contact)],
                });
                send_request(
                    ctx,
                    &api_key,
                    Method::Put,
                    "/marketing/contacts",
                    Some(payload),
                )
                .await?
            }
            ("contact", "get") => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let path = format!("/marketing/contacts/{contact_id}");
                send_request(ctx, &api_key, Method::Get, &path, None).await?
            }
            ("contact", "list") => {
                send_request(ctx, &api_key, Method::Get, "/marketing/contacts", None).await?
            }
            ("contact", "delete") => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let path = format!(
                    "/marketing/contacts?ids={}",
                    urlencoding::encode(&contact_id)
                );
                send_request(ctx, &api_key, Method::Delete, &path, None).await?
            }
            // ----- Lists -----
            ("list", "create") => {
                let list_name = ctx.param_str(params, "listName")?;
                let payload = json!({ "name": list_name });
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    "/marketing/lists",
                    Some(payload),
                )
                .await?
            }
            ("list", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                let path = format!("/marketing/lists/{list_id}");
                send_request(ctx, &api_key, Method::Get, &path, None).await?
            }
            ("list", "getAll") => {
                send_request(ctx, &api_key, Method::Get, "/marketing/lists", None).await?
            }
            ("list", "delete") => {
                let list_id = ctx.param_str(params, "listId")?;
                let path = format!("/marketing/lists/{list_id}");
                send_request(ctx, &api_key, Method::Delete, &path, None).await?
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
    path: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let url = format!("{SENDGRID_API_BASE}{path}");
    let mut req = match method {
        Method::Get => ctx.http.get(&url),
        Method::Post => ctx.http.post(&url),
        Method::Put => ctx.http.put(&url),
        Method::Delete => ctx.http.delete(&url),
    };
    req = req
        .bearer_auth(api_key)
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
