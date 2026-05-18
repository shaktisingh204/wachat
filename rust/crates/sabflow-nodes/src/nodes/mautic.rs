//! Mautic node.
//!
//! Implements contact, segment, and campaign operations against a self-hosted
//! Mautic instance. Authenticates using HTTP Basic with a Mautic username and
//! password (Mautic also supports OAuth2, which is not modelled here for the
//! C.5 scope).
//!
//! Base URL is taken from the credential `baseUrl` (e.g.
//! `https://mautic.example.com`); all REST endpoints are namespaced under
//! `/api`.

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

pub struct MauticNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MauticNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mautic",
            "Mautic",
            "Manage contacts, segments, and campaigns in a self-hosted Mautic instance",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#4E5E9E")
        .credentials(vec![CredentialBinding {
            name: "mauticApi".into(),
            display_name: "Mautic API (Basic)".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Segment", "segment"),
                    opt("Campaign", "campaign"),
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
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .show_when("resource", &["contact"])
                .required(),
            // segment ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Add Contact", "addContact"),
                    opt("Remove Contact", "removeContact"),
                ])
                .default(json!("list"))
                .show_when("resource", &["segment"])
                .required(),
            // campaign ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Add Contact", "addContact"),
                    opt("Remove Contact", "removeContact"),
                ])
                .default(json!("list"))
                .show_when("resource", &["campaign"])
                .required(),
            // contact fields
            NodeProperty::new("contactId", "Contact ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete", "addContact", "removeContact"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("firstname", "First Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("lastname", "Last Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("additionalFields", "Additional Fields", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description("JSON object of additional contact fields"),
            // segment / campaign id
            NodeProperty::new("segmentId", "Segment ID", NodePropertyType::String)
                .show_when("resource", &["segment"])
                .description("Numeric Mautic segment id (required for add/remove contact)"),
            NodeProperty::new("campaignId", "Campaign ID", NodePropertyType::String)
                .show_when("resource", &["campaign"])
                .description("Numeric Mautic campaign id (required for add/remove contact)"),
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
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?;
        let username = cred
            .data
            .get("username")
            .ok_or_else(|| NodeError::MissingParameter("username".into()))?
            .clone();
        let password = cred
            .data
            .get("password")
            .ok_or_else(|| NodeError::MissingParameter("password".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Contacts -----
            ("contact", "create") => {
                let payload = build_contact_payload(ctx, params)?;
                let url = format!("{base_url}/api/contacts/new");
                send_request(ctx, &username, &password, Method::Post, &url, Some(payload)).await?
            }
            ("contact", "get") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/contacts/{id}");
                send_request(ctx, &username, &password, Method::Get, &url, None).await?
            }
            ("contact", "update") => {
                let id = ctx.param_str(params, "contactId")?;
                let payload = build_contact_payload(ctx, params)?;
                let url = format!("{base_url}/api/contacts/{id}/edit");
                send_request(ctx, &username, &password, Method::Patch, &url, Some(payload))
                    .await?
            }
            ("contact", "delete") => {
                let id = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/contacts/{id}/delete");
                send_request(ctx, &username, &password, Method::Delete, &url, None).await?
            }
            ("contact", "list") => {
                let url = format!("{base_url}/api/contacts");
                send_request(ctx, &username, &password, Method::Get, &url, None).await?
            }
            // ----- Segments -----
            ("segment", "list") => {
                let url = format!("{base_url}/api/segments");
                send_request(ctx, &username, &password, Method::Get, &url, None).await?
            }
            ("segment", "addContact") => {
                let seg = ctx.param_str(params, "segmentId")?;
                let contact = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/segments/{seg}/contact/{contact}/add");
                send_request(ctx, &username, &password, Method::Post, &url, None).await?
            }
            ("segment", "removeContact") => {
                let seg = ctx.param_str(params, "segmentId")?;
                let contact = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/segments/{seg}/contact/{contact}/remove");
                send_request(ctx, &username, &password, Method::Post, &url, None).await?
            }
            // ----- Campaigns -----
            ("campaign", "list") => {
                let url = format!("{base_url}/api/campaigns");
                send_request(ctx, &username, &password, Method::Get, &url, None).await?
            }
            ("campaign", "addContact") => {
                let camp = ctx.param_str(params, "campaignId")?;
                let contact = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/campaigns/{camp}/contact/{contact}/add");
                send_request(ctx, &username, &password, Method::Post, &url, None).await?
            }
            ("campaign", "removeContact") => {
                let camp = ctx.param_str(params, "campaignId")?;
                let contact = ctx.param_str(params, "contactId")?;
                let url = format!("{base_url}/api/campaigns/{camp}/contact/{contact}/remove");
                send_request(ctx, &username, &password, Method::Post, &url, None).await?
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

fn build_contact_payload(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let mut payload = Map::new();
    if let Some(email) = ctx.param_str_opt(params, "email") {
        if !email.trim().is_empty() {
            payload.insert("email".into(), Value::String(email));
        }
    }
    if let Some(first) = ctx.param_str_opt(params, "firstname") {
        if !first.trim().is_empty() {
            payload.insert("firstname".into(), Value::String(first));
        }
    }
    if let Some(last) = ctx.param_str_opt(params, "lastname") {
        if !last.trim().is_empty() {
            payload.insert("lastname".into(), Value::String(last));
        }
    }
    if let Some(extra) = parse_json_param(ctx, params, "additionalFields") {
        if let Value::Object(map) = extra {
            for (k, v) in map {
                payload.insert(k, v);
            }
        }
    }
    Ok(Value::Object(payload))
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
    username: &str,
    password: &str,
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
        .basic_auth(username, Some(password))
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
