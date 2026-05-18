//! Freshdesk node.
//!
//! Implements ticket and contact operations against the Freshdesk v2 REST API
//! (https://{domain}.freshdesk.com/api/v2). Authenticates via HTTP Basic auth
//! using the API key as the username and `X` as the password — both supplied
//! via the `freshdeskApi` credential (`domain`, `apiKey`).

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

pub struct FreshdeskNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for FreshdeskNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "freshdesk",
            "Freshdesk",
            "Freshdesk customer support — manage tickets and contacts",
            NodeCategory::Communication,
        )
        .icon("life-buoy")
        .color("#25C16F")
        .credentials(vec![CredentialBinding {
            name: "freshdeskApi".into(),
            display_name: "Freshdesk API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Ticket", "ticket"),
                    opt("Contact", "contact"),
                    opt("Agent", "agent"),
                    opt("Company", "company"),
                ])
                .default(json!("ticket"))
                .required(),
            // ---- ticket operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["ticket"])
                .required(),
            // ---- contact operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["contact"])
                .required(),
            // ---- agent operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get"), opt("Me", "me")])
                .default(json!("list"))
                .show_when("resource", &["agent"])
                .required(),
            // ---- company operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["company"])
                .required(),
            // ---- shared id
            NodeProperty::new("id", "ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            // ---- create / update payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"subject\": \"Help\", \"description\": \"...\", \"priority\": 1, \"status\": 2 }")
                .show_when("operation", &["create", "update"])
                .description("Request body."),
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
        let domain = cred
            .data
            .get("domain")
            .ok_or_else(|| NodeError::MissingParameter("domain".into()))?
            .clone();
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        // Freshdesk accepts either "company.freshdesk.com" or just "company".
        let base = if domain.contains('.') {
            format!("https://{domain}/api/v2")
        } else {
            format!("https://{domain}.freshdesk.com/api/v2")
        };

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "ticket".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let collection = match resource.as_str() {
            "ticket" => "tickets",
            "contact" => "contacts",
            "agent" => "agents",
            "company" => "companies",
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "resource".into(),
                    reason: format!("unknown resource: {other}"),
                });
            }
        };

        let body: Value = match operation.as_str() {
            "list" => get_json(ctx, &base, &api_key, &format!("/{collection}")).await?,
            "get" => {
                let id = ctx.param_str(params, "id")?;
                get_json(ctx, &base, &api_key, &format!("/{collection}/{id}")).await?
            }
            "me" if resource == "agent" => get_json(ctx, &base, &api_key, "/agents/me").await?,
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &base, &api_key, &format!("/{collection}"), payload).await?
            }
            "update" => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                put_json(
                    ctx,
                    &base,
                    &api_key,
                    &format!("/{collection}/{id}"),
                    payload,
                )
                .await?
            }
            "delete" => {
                let id = ctx.param_str(params, "id")?;
                delete_json(ctx, &base, &api_key, &format!("/{collection}/{id}")).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported operation '{other}' for resource '{resource}'"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn get_json(
    ctx: &ExecutionContext,
    base: &str,
    api_key: &str,
    path: &str,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx.http.get(&url).basic_auth(api_key, Some("X")).send().await?;
    finalize_response(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    base: &str,
    api_key: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx
        .http
        .post(&url)
        .basic_auth(api_key, Some("X"))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put_json(
    ctx: &ExecutionContext,
    base: &str,
    api_key: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx
        .http
        .put(&url)
        .basic_auth(api_key, Some("X"))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn delete_json(
    ctx: &ExecutionContext,
    base: &str,
    api_key: &str,
    path: &str,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx.http.delete(&url).basic_auth(api_key, Some("X")).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
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
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
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
