//! Salesforce node.
//!
//! Implements CRM operations against the Salesforce REST API
//! (`{instanceUrl}/services/data/v60.0`). Authenticates with a Bearer access
//! token supplied via the `salesforceOAuth2` credential (fields `instanceUrl`
//! and `accessToken`).

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

pub struct SalesforceNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const SALESFORCE_API_VERSION: &str = "v60.0";

#[async_trait]
impl Node for SalesforceNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "salesforce",
            "Salesforce",
            "Manage Salesforce records (accounts, contacts, leads, opportunities, cases, tasks) and run SOQL queries",
            NodeCategory::Crm,
        )
        .icon("cloud")
        .color("#00A1E0")
        .credentials(vec![CredentialBinding {
            name: "salesforceOAuth2".into(),
            display_name: "Salesforce OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Account", "account"),
                    opt("Contact", "contact"),
                    opt("Lead", "lead"),
                    opt("Opportunity", "opportunity"),
                    opt("Case", "case"),
                    opt("Task", "task"),
                    opt("Query (SOQL)", "query"),
                ])
                .default(json!("account"))
                .required(),
            // SObject CRUD operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Get All", "getAll"),
                ])
                .default(json!("create"))
                .show_when(
                    "resource",
                    &["account", "contact", "lead", "opportunity", "case", "task"],
                )
                .required(),
            // Query operation
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Execute SOQL Query", "executeQuery")])
                .default(json!("executeQuery"))
                .show_when("resource", &["query"])
                .required(),
            NodeProperty::new("objectId", "Record ID", NodePropertyType::String)
                .placeholder("0015g00000XXXXXXXX")
                .description("Salesforce 18-character record ID")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("fields", "Fields (JSON)", NodePropertyType::Json)
                .placeholder("{ \"Name\": \"Acme Corp\", \"Phone\": \"555-1234\" }")
                .description("Record fields as a JSON object")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["getAll"]),
            NodeProperty::new("soql", "SOQL Query", NodePropertyType::String)
                .placeholder("SELECT Id, Name FROM Account LIMIT 10")
                .show_when("operation", &["executeQuery"])
                .required(),
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
        let instance_url = cred
            .data
            .get("instanceUrl")
            .ok_or_else(|| NodeError::MissingParameter("instanceUrl".into()))?
            .trim_end_matches('/')
            .to_string();

        let api_base = format!(
            "{instance_url}/services/data/{version}",
            version = SALESFORCE_API_VERSION
        );

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "account".to_string());
        let operation = ctx.param_str(params, "operation")?;

        if resource == "query" {
            if operation != "executeQuery" {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation for query resource: {operation}"),
                });
            }
            let raw_soql = ctx.param_str(params, "soql")?;
            let soql = ctx.substitute(&raw_soql);
            let encoded = urlencode(&soql);
            let url = format!("{api_base}/query/?q={encoded}");
            let body = get_json(ctx, &token, &url).await?;
            return Ok(NodeOutput::single(vec![body]));
        }

        let sobject = sobject_name(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let body: Value = match operation.as_str() {
            "create" => {
                let fields = parse_json_param(ctx, params, "fields")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/sobjects/{sobject}");
                post_json(ctx, &token, &url, fields).await?
            }
            "get" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let url = format!("{api_base}/sobjects/{sobject}/{id}");
                get_json(ctx, &token, &url).await?
            }
            "update" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let fields = parse_json_param(ctx, params, "fields")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/sobjects/{sobject}/{id}");
                patch_json(ctx, &token, &url, fields).await?
            }
            "delete" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let url = format!("{api_base}/sobjects/{sobject}/{id}");
                delete_json(ctx, &token, &url).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let soql = format!("SELECT Id, Name FROM {sobject} LIMIT {limit}");
                let encoded = urlencode(&soql);
                let url = format!("{api_base}/query/?q={encoded}");
                get_json(ctx, &token, &url).await?
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

fn sobject_name(resource: &str) -> Option<&'static str> {
    match resource {
        "account" => Some("Account"),
        "contact" => Some("Contact"),
        "lead" => Some("Lead"),
        "opportunity" => Some("Opportunity"),
        "case" => Some("Case"),
        "task" => Some("Task"),
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
    url: &str,
    payload: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .patch(url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        let body: Value = res.json().await.unwrap_or(Value::Null);
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    // Salesforce returns 204 No Content for successful PATCH updates.
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if body.is_null() {
        Ok(json!({ "success": true, "updated": true }))
    } else {
        Ok(body)
    }
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<Value> {
    let res = ctx.http.get(url).bearer_auth(token).send().await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<Value> {
    let res = ctx.http.delete(url).bearer_auth(token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let body: Value = res.json().await.unwrap_or(Value::Null);
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
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

/// Minimal URL-encoder for SOQL query strings. Encodes characters outside of
/// the unreserved set as `%HH`. We avoid pulling in a new dependency.
fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        let unreserved = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if unreserved {
            out.push(b as char);
        } else {
            out.push('%');
            out.push_str(&format!("{:02X}", b));
        }
    }
    out
}
