//! Zoho CRM node.
//!
//! Implements CRUD operations against the Zoho CRM v2 REST API
//! (https://www.zohoapis.{dataCenter}/crm/v2). Authenticates with an OAuth2
//! access token supplied via the `zohoOAuth2` credential (`accessToken` field,
//! `dataCenter` field — default `"com"`).

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

pub struct ZohoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ZohoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zoho",
            "Zoho",
            "Manage Zoho CRM leads, contacts, accounts and deals",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#C8202E")
        .credentials(vec![CredentialBinding {
            name: "zohoOAuth2".into(),
            display_name: "Zoho OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Lead", "lead"),
                    opt("Contact", "contact"),
                    opt("Account", "account"),
                    opt("Deal", "deal"),
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
                .placeholder("1234567890")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"Last_Name\": \"Doe\", \"Email\": \"jane@example.com\" }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object"),
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();
        let data_center = cred
            .data
            .get("dataCenter")
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "com".to_string());

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "lead".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let module = resource_module(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let api_base = format!("https://www.zohoapis.{data_center}/crm/v2");

        let body: Value = match operation.as_str() {
            "create" => {
                let record = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ "data": [record] });
                let url = format!("{api_base}/{module}");
                post_json(ctx, &token, &url, payload).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{module}/{id}");
                get_json(ctx, &token, &url).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let url = format!("{api_base}/{module}?per_page={limit}");
                get_json(ctx, &token, &url).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let record = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ "data": [record] });
                let url = format!("{api_base}/{module}/{id}");
                put_json(ctx, &token, &url, payload).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{module}/{id}");
                delete_json(ctx, &token, &url).await?
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

fn resource_module(resource: &str) -> Option<&'static str> {
    match resource {
        "lead" => Some("Leads"),
        "contact" => Some("Contacts"),
        "account" => Some("Accounts"),
        "deal" => Some("Deals"),
        _ => None,
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .post(url)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Zoho-oauthtoken {token}"),
        )
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .put(url)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Zoho-oauthtoken {token}"),
        )
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<Value> {
    let res = ctx
        .http
        .get(url)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Zoho-oauthtoken {token}"),
        )
        .send()
        .await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<Value> {
    let res = ctx
        .http
        .delete(url)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Zoho-oauthtoken {token}"),
        )
        .send()
        .await?;
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
