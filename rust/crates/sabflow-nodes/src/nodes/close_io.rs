//! Close (close.io) CRM node.
//!
//! Implements CRUD operations against the Close v1 REST API
//! (https://api.close.com/api/v1). Close uses HTTP Basic Auth with the API
//! key as the username and an empty password — supplied via the `closeApi`
//! credential (`apiKey` field).
//!
//! Resources covered: lead, contact, opportunity, task, activity.

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

pub struct CloseIoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CloseIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "closeIo",
            "Close",
            "Manage Close (close.io) leads, contacts, opportunities and tasks",
            NodeCategory::Sales,
        )
        .icon("target")
        .color("#0C9B6F")
        .credentials(vec![CredentialBinding {
            name: "closeApi".into(),
            display_name: "Close API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Lead", "lead"),
                    opt("Contact", "contact"),
                    opt("Opportunity", "opportunity"),
                    opt("Task", "task"),
                    opt("Activity (Note)", "activity"),
                ])
                .default(json!("lead"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("objectId", "Record ID", NodePropertyType::String)
                .placeholder("lead_xxxxxxxxxxxx")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"name\": \"Acme Inc\", \"contacts\": [{ \"name\": \"Jane Doe\", \"emails\": [{ \"email\": \"jane@example.com\" }] }] }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["getAll"]),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .show_when("operation", &["getAll"])
                .description("Close search query, e.g. `lead_status:\"Potential\"`"),
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
            .unwrap_or_else(|| "lead".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let path = resource_path(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let base_url = "https://api.close.com/api/v1".to_string();

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/");
                close_request(ctx, "POST", &url, &api_key, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}/");
                close_request(ctx, "GET", &url, &api_key, None).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let query = ctx
                    .param_str_opt(params, "query")
                    .unwrap_or_default();
                let mut url = format!("{base_url}/{path}/?_limit={limit}");
                if !query.trim().is_empty() {
                    let encoded = url_encode(&query);
                    url.push_str(&format!("&query={encoded}"));
                }
                close_request(ctx, "GET", &url, &api_key, None).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/{id}/");
                close_request(ctx, "PUT", &url, &api_key, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}/");
                close_request(ctx, "DELETE", &url, &api_key, None).await?
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

fn resource_path(resource: &str) -> Option<&'static str> {
    match resource {
        "lead" => Some("lead"),
        "contact" => Some("contact"),
        "opportunity" => Some("opportunity"),
        "task" => Some("task"),
        // Close models "activities" (notes, calls, etc.) under /activity/note/
        // — we expose the note variant by default; consumers can hit the raw
        // HTTP node for other activity subtypes.
        "activity" => Some("activity/note"),
        _ => None,
    }
}

async fn close_request(
    ctx: &ExecutionContext,
    method: &str,
    url: &str,
    api_key: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        "GET" => ctx.http.get(url),
        "POST" => ctx.http.post(url),
        "PUT" => ctx.http.put(url),
        "DELETE" => ctx.http.delete(url),
        other => {
            return Err(NodeError::InvalidParameter {
                name: "method".into(),
                reason: format!("unsupported method: {other}"),
            });
        }
    };
    req = req
        .basic_auth(api_key, Some(""))
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::CONTENT_TYPE, "application/json");

    if let Some(body) = payload {
        req = req.json(&body);
    }

    let res = req.send().await?;
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    if body.is_null() && method == "DELETE" {
        Ok(json!({ "deleted": true }))
    } else {
        Ok(body)
    }
}

/// Minimal percent-encoder for query string values. Encodes the standard
/// reserved characters per RFC 3986 — sufficient for Close search queries.
fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
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
