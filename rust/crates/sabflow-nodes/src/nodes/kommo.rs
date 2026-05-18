//! Kommo (formerly amoCRM) node.
//!
//! Implements CRUD operations against the Kommo v4 REST API
//! (https://{subdomain}.kommo.com/api/v4). Kommo authenticates with a long-
//! lived Bearer access token (OAuth2). For C.5 we expose the typed descriptor
//! + parameter parsing, and execute the requests via Bearer auth.
//!
//! Credential `kommoOAuth2` provides `accessToken` + `subdomain`. Token
//! refresh / OAuth dance lives in the credentials layer — this node simply
//! consumes whatever access token the credential currently holds.
//!
//! Resources covered: lead, contact, company, task, note.

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

pub struct KommoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for KommoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "kommo",
            "Kommo",
            "Manage Kommo (amoCRM) leads, contacts, companies and tasks",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#FFCE5C")
        .credentials(vec![CredentialBinding {
            name: "kommoOAuth2".into(),
            display_name: "Kommo OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Lead", "lead"),
                    opt("Contact", "contact"),
                    opt("Company", "company"),
                    opt("Task", "task"),
                    opt("Note", "note"),
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
                .placeholder("123456")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("[{ \"name\": \"New deal\", \"price\": 5000 }]")
                .show_when("operation", &["create", "update"])
                .description("Kommo v4 expects an array of records for create/update; pass either a single object or a JSON array"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["getAll"]),
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
        let subdomain = cred
            .data
            .get("subdomain")
            .ok_or_else(|| NodeError::MissingParameter("subdomain".into()))?
            .trim_end_matches('/')
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "lead".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let path = resource_path(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let api_base = format!("https://{subdomain}.kommo.com/api/v4");

        let body: Value = match operation.as_str() {
            "create" => {
                // Kommo accepts an array of records. Wrap single objects.
                let raw = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let payload = match raw {
                    Value::Array(_) => raw,
                    other => Value::Array(vec![other]),
                };
                let url = format!("{api_base}/{path}");
                kommo_request(ctx, "POST", &url, &access_token, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{path}/{id}");
                kommo_request(ctx, "GET", &url, &access_token, None).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(50);
                let url = format!("{api_base}/{path}?limit={limit}");
                kommo_request(ctx, "GET", &url, &access_token, None).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/{path}/{id}");
                kommo_request(ctx, "PATCH", &url, &access_token, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{path}/{id}");
                kommo_request(ctx, "DELETE", &url, &access_token, None).await?
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
        "lead" => Some("leads"),
        "contact" => Some("contacts"),
        "company" => Some("companies"),
        "task" => Some("tasks"),
        "note" => Some("notes"),
        _ => None,
    }
}

async fn kommo_request(
    ctx: &ExecutionContext,
    method: &str,
    url: &str,
    access_token: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        "GET" => ctx.http.get(url),
        "POST" => ctx.http.post(url),
        "PUT" => ctx.http.put(url),
        "PATCH" => ctx.http.patch(url),
        "DELETE" => ctx.http.delete(url),
        other => {
            return Err(NodeError::InvalidParameter {
                name: "method".into(),
                reason: format!("unsupported method: {other}"),
            });
        }
    };
    req = req
        .bearer_auth(access_token)
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
