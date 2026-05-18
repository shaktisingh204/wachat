//! Copper CRM node.
//!
//! Implements CRUD operations against the Copper Developer API v1
//! (https://api.copper.com/developer_api/v1). Copper authenticates with three
//! headers — `X-PW-AccessToken`, `X-PW-Application`, `X-PW-UserEmail` — all
//! supplied via the `copperApi` credential (`apiKey` + `userEmail` fields).
//!
//! Resources covered: person, lead, opportunity, company, task, activity.

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

pub struct CopperNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CopperNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "copper",
            "Copper",
            "Manage Copper CRM people, leads, opportunities and companies",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#FF6B35")
        .credentials(vec![CredentialBinding {
            name: "copperApi".into(),
            display_name: "Copper API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Person", "person"),
                    opt("Lead", "lead"),
                    opt("Opportunity", "opportunity"),
                    opt("Company", "company"),
                    opt("Task", "task"),
                    opt("Activity", "activity"),
                ])
                .default(json!("person"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Search", "search"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("objectId", "Record ID", NodePropertyType::String)
                .placeholder("12345678")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"name\": \"Jane Doe\", \"emails\": [{ \"email\": \"jane@example.com\", \"category\": \"work\" }] }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object"),
            NodeProperty::new("searchFilters", "Search Filters (JSON)", NodePropertyType::Json)
                .placeholder("{ \"page_size\": 25, \"sort_by\": \"name\" }")
                .show_when("operation", &["search"])
                .description("Copper search filter object — see https://developer.copper.com"),
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
        let user_email = cred
            .data
            .get("userEmail")
            .ok_or_else(|| NodeError::MissingParameter("userEmail".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "person".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let path = resource_path(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let base_url = "https://api.copper.com/developer_api/v1".to_string();

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}");
                copper_request(ctx, "POST", &url, &api_key, &user_email, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                copper_request(ctx, "GET", &url, &api_key, &user_email, None).await?
            }
            "search" => {
                let filters = parse_json_param(ctx, params, "searchFilters")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/search");
                copper_request(ctx, "POST", &url, &api_key, &user_email, Some(filters)).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/{id}");
                copper_request(ctx, "PUT", &url, &api_key, &user_email, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                copper_request(ctx, "DELETE", &url, &api_key, &user_email, None).await?
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
        "person" => Some("people"),
        "lead" => Some("leads"),
        "opportunity" => Some("opportunities"),
        "company" => Some("companies"),
        "task" => Some("tasks"),
        "activity" => Some("activities"),
        _ => None,
    }
}

async fn copper_request(
    ctx: &ExecutionContext,
    method: &str,
    url: &str,
    api_key: &str,
    user_email: &str,
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
        .header("X-PW-AccessToken", api_key)
        .header("X-PW-Application", "developer_api")
        .header("X-PW-UserEmail", user_email)
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
