//! HubSpot node.
//!
//! Implements CRM operations against the HubSpot v3 CRM Objects API
//! (https://api.hubapi.com/crm/v3/objects). Authenticates with a Private App
//! Token (Bearer) supplied via the `hubspotApi` credential (`accessToken`
//! field — value like `pat-...`).

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

pub struct HubspotNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const HUBSPOT_API_BASE: &str = "https://api.hubapi.com/crm/v3/objects";

#[async_trait]
impl Node for HubspotNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "hubspot",
            "HubSpot",
            "Manage HubSpot contacts, companies, deals and tickets",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#FF7A59")
        .credentials(vec![CredentialBinding {
            name: "hubspotApi".into(),
            display_name: "HubSpot Private App Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Company", "company"),
                    opt("Deal", "deal"),
                    opt("Ticket", "ticket"),
                ])
                .default(json!("contact"))
                .required(),
            // Contact operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Search", "search"),
                ])
                .default(json!("create"))
                .show_when("resource", &["contact"])
                .required(),
            // Company / deal / ticket operations (no search)
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["company", "deal", "ticket"])
                .required(),
            NodeProperty::new("objectId", "Object ID", NodePropertyType::String)
                .placeholder("12345")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("properties", "Properties (JSON)", NodePropertyType::Json)
                .placeholder("{ \"email\": \"alice@example.com\", \"firstname\": \"Alice\" }")
                .show_when("operation", &["create", "update"])
                .description("Object properties as a JSON object"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["getAll"]),
            NodeProperty::new("query", "Search Query", NodePropertyType::String)
                .placeholder("alice@example.com")
                .show_when("operation", &["search"]),
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

        let path = resource_path(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let body: Value = match operation.as_str() {
            "create" => {
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ "properties": properties });
                post_json(ctx, &token, path, payload).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let endpoint = format!("{path}/{id}");
                get_json(ctx, &token, &endpoint).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let limit_str = limit.to_string();
                let endpoint = format!("{path}?limit={limit_str}");
                get_json(ctx, &token, &endpoint).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ "properties": properties });
                let endpoint = format!("{path}/{id}");
                patch_json(ctx, &token, &endpoint, payload).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let endpoint = format!("{path}/{id}");
                delete_json(ctx, &token, &endpoint).await?
            }
            "search" => {
                if resource != "contact" {
                    return Err(NodeError::InvalidParameter {
                        name: "operation".into(),
                        reason: format!("search not supported for resource: {resource}"),
                    });
                }
                let query = ctx.param_str(params, "query")?;
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let endpoint = format!("{path}/search");
                let payload = json!({ "query": query, "limit": limit });
                post_json(ctx, &token, &endpoint, payload).await?
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
        "contact" => Some("contacts"),
        "company" => Some("companies"),
        "deal" => Some("deals"),
        "ticket" => Some("tickets"),
        _ => None,
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{HUBSPOT_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn patch_json(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{HUBSPOT_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .patch(&url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(ctx: &ExecutionContext, token: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{HUBSPOT_API_BASE}/{endpoint}");
    let res = ctx.http.get(&url).bearer_auth(token).send().await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, token: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{HUBSPOT_API_BASE}/{endpoint}");
    let res = ctx.http.delete(&url).bearer_auth(token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let body: Value = res.json().await.unwrap_or(Value::Null);
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    // HubSpot returns 204 No Content for delete — surface a small envelope.
    let body: Value = res.json().await.unwrap_or(Value::Null);
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
/// value (array/object) or a string holding JSON. Returns `None` if absent
/// or empty.
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
