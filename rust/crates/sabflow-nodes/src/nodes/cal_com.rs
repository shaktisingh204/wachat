//! Cal.com node.
//!
//! Implements scheduling operations against the Cal.com v1 REST API
//! (https://api.cal.com/v1). Authenticates by appending `?apiKey=...` to every
//! request — the key is supplied via the `calComApi` credential (`apiKey`).

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

pub struct CalComNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const CAL_API_BASE: &str = "https://api.cal.com/v1";

#[async_trait]
impl Node for CalComNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "cal",
            "Cal.com",
            "Cal.com open-source scheduling",
            NodeCategory::Productivity,
        )
        .icon("calendar")
        .color("#111827")
        .credentials(vec![CredentialBinding {
            name: "calComApi".into(),
            display_name: "Cal.com API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Booking", "booking"),
                    opt("Event Type", "eventType"),
                    opt("User", "user"),
                    opt("Schedule", "schedule"),
                ])
                .default(json!("booking"))
                .required(),
            // ---- booking operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Cancel", "cancel"),
                ])
                .default(json!("list"))
                .show_when("resource", &["booking"])
                .required(),
            // ---- event type operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                ])
                .default(json!("list"))
                .show_when("resource", &["eventType"])
                .required(),
            // ---- user operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Me", "me"),
                ])
                .default(json!("list"))
                .show_when("resource", &["user"])
                .required(),
            // ---- schedule operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["schedule"])
                .required(),
            // ---- shared id field
            NodeProperty::new("id", "ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("operation", &["get", "cancel"])
                .required(),
            // ---- create payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"eventTypeId\": 1, \"start\": \"2025-01-01T10:00:00Z\" }")
                .show_when("operation", &["create"])
                .description("Request body as a JSON object."),
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
            .unwrap_or_else(|| "booking".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // -------- bookings
            ("booking", "list") => get_json(ctx, &api_key, "/bookings").await?,
            ("booking", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/bookings/{id}");
                get_json(ctx, &api_key, &path).await?
            }
            ("booking", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &api_key, "/bookings", payload).await?
            }
            ("booking", "cancel") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/bookings/{id}");
                delete_json(ctx, &api_key, &path).await?
            }
            // -------- event types
            ("eventType", "list") => get_json(ctx, &api_key, "/event-types").await?,
            ("eventType", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/event-types/{id}");
                get_json(ctx, &api_key, &path).await?
            }
            ("eventType", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &api_key, "/event-types", payload).await?
            }
            // -------- users
            ("user", "list") => get_json(ctx, &api_key, "/users").await?,
            ("user", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/users/{id}");
                get_json(ctx, &api_key, &path).await?
            }
            ("user", "me") => get_json(ctx, &api_key, "/me").await?,
            // -------- schedules
            ("schedule", "list") => get_json(ctx, &api_key, "/schedules").await?,
            ("schedule", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/schedules/{id}");
                get_json(ctx, &api_key, &path).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported {res}/{op} combination"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

fn build_url(path: &str, api_key: &str) -> String {
    let encoded = urlencoding::encode(api_key);
    let sep = if path.contains('?') { '&' } else { '?' };
    format!("{CAL_API_BASE}{path}{sep}apiKey={encoded}")
}

async fn get_json(ctx: &ExecutionContext, api_key: &str, path: &str) -> NodeResult<Value> {
    let url = build_url(path, api_key);
    let res = ctx.http.get(&url).send().await?;
    finalize_response(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = build_url(path, api_key);
    let res = ctx
        .http
        .post(&url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, api_key: &str, path: &str) -> NodeResult<Value> {
    let url = build_url(path, api_key);
    let res = ctx.http.delete(&url).send().await?;
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    if body.is_null() {
        Ok(json!({ "deleted": true }))
    } else {
        Ok(body)
    }
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
/// value (array/object) or a string holding JSON. Returns `None` if absent or
/// empty.
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
