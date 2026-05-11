//! Pipedrive node.
//!
//! Implements CRUD operations against the Pipedrive v1 REST API
//! (https://{companyDomain}.pipedrive.com/api/v1). Pipedrive authenticates
//! requests with an `api_token` query parameter (NOT a bearer token), supplied
//! via the `pipedriveApi` credential (`apiToken` + `companyDomain` fields).

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

pub struct PipedriveNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PipedriveNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pipedrive",
            "Pipedrive",
            "Manage Pipedrive deals, persons, organizations, leads, notes and activities",
            NodeCategory::Sales,
        )
        .icon("users")
        .color("#1A1F36")
        .credentials(vec![CredentialBinding {
            name: "pipedriveApi".into(),
            display_name: "Pipedrive API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Deal", "deal"),
                    opt("Person", "person"),
                    opt("Organization", "organization"),
                    opt("Lead", "lead"),
                    opt("Note", "note"),
                    opt("Activity", "activity"),
                ])
                .default(json!("deal"))
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
            NodeProperty::new("objectId", "Object ID", NodePropertyType::Number)
                .placeholder("12345")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("properties", "Properties (JSON)", NodePropertyType::Json)
                .placeholder("{ \"title\": \"New deal\", \"value\": 1000, \"currency\": \"USD\" }")
                .show_when("operation", &["create", "update"])
                .description("Field map sent as the JSON body"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
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
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();
        let company_domain = cred
            .data
            .get("companyDomain")
            .ok_or_else(|| NodeError::MissingParameter("companyDomain".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "deal".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let path = resource_path(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let base_url = format!("https://{company_domain}.pipedrive.com/api/v1");

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}");
                post_json(ctx, &url, &api_token, payload).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                get_json(ctx, &url, &api_token).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let url = format!("{base_url}/{path}?limit={limit}");
                get_json(ctx, &url, &api_token).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let payload = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/{id}");
                put_json(ctx, &url, &api_token, payload).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                delete_json(ctx, &url, &api_token).await?
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
        "deal" => Some("deals"),
        "person" => Some("persons"),
        "organization" => Some("organizations"),
        "lead" => Some("leads"),
        "note" => Some("notes"),
        "activity" => Some("activities"),
        _ => None,
    }
}

/// Append the `api_token` query parameter to a URL that may or may not
/// already contain a `?`.
fn with_token(url: &str, token: &str) -> String {
    if url.contains('?') {
        format!("{url}&api_token={token}")
    } else {
        format!("{url}?api_token={token}")
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    url: &str,
    token: &str,
    payload: Value,
) -> NodeResult<Value> {
    let full = with_token(url, token);
    let res = ctx
        .http
        .post(&full)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put_json(
    ctx: &ExecutionContext,
    url: &str,
    token: &str,
    payload: Value,
) -> NodeResult<Value> {
    let full = with_token(url, token);
    let res = ctx
        .http
        .put(&full)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(ctx: &ExecutionContext, url: &str, token: &str) -> NodeResult<Value> {
    let full = with_token(url, token);
    let res = ctx.http.get(&full).send().await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, url: &str, token: &str) -> NodeResult<Value> {
    let full = with_token(url, token);
    let res = ctx.http.delete(&full).send().await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

/// Pull a JSON-shaped property out of `params`. Accepts either a native JSON
/// value (array/object) or a string holding JSON. Returns `None` if absent
/// or empty. All string leaves get `ctx.substitute` applied so `{{var}}`
/// placeholders resolve.
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

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
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
