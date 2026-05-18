//! Freshworks CRM node (formerly Freshsales).
//!
//! Implements CRUD operations against the Freshworks CRM v2 REST API
//! (https://{bundleAlias}/crm/sales/api). Authenticates with `Authorization:
//! Token token=<apiKey>` header — supplied via the `freshworksCrmApi`
//! credential (`apiKey` + `bundleAlias` fields, e.g.
//! `mycompany.myfreshworks.com`).
//!
//! Resources covered: contact, account, lead, deal, task, sales_activity.

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

pub struct FreshworksCrmNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for FreshworksCrmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "freshworksCrm",
            "Freshworks CRM",
            "Manage Freshworks CRM contacts, accounts, leads and deals",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#45A4EC")
        .credentials(vec![CredentialBinding {
            name: "freshworksCrmApi".into(),
            display_name: "Freshworks CRM API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Account", "account"),
                    opt("Lead", "lead"),
                    opt("Deal", "deal"),
                    opt("Task", "task"),
                    opt("Sales Activity", "salesActivity"),
                ])
                .default(json!("contact"))
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
                .placeholder("17000000123")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"first_name\": \"Jane\", \"last_name\": \"Doe\", \"email\": \"jane@example.com\" }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object — sent inside the API's singular wrapper"),
            NodeProperty::new("limit", "Per Page", NodePropertyType::Number)
                .default(json!(25))
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();
        let bundle = cred
            .data
            .get("bundleAlias")
            .ok_or_else(|| NodeError::MissingParameter("bundleAlias".into()))?
            .trim_end_matches('/')
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let (path, wrapper, list_view) =
            resource_info(&resource).ok_or_else(|| NodeError::InvalidParameter {
                name: "resource".into(),
                reason: format!("unknown resource: {resource}"),
            })?;

        let api_base = format!("https://{bundle}/crm/sales/api");

        let body: Value = match operation.as_str() {
            "create" => {
                let record = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ wrapper: record });
                let url = format!("{api_base}/{path}");
                freshworks_request(ctx, "POST", &url, &api_key, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{path}/{id}");
                freshworks_request(ctx, "GET", &url, &api_key, None).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(25);
                // Freshworks list endpoints require a "view" id; we use the
                // built-in "All" filter via /filters which returns the default
                // list when no view is selected.
                let url = format!("{api_base}/{path}/{list_view}?per_page={limit}");
                freshworks_request(ctx, "GET", &url, &api_key, None).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let record = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ wrapper: record });
                let url = format!("{api_base}/{path}/{id}");
                freshworks_request(ctx, "PUT", &url, &api_key, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{path}/{id}");
                freshworks_request(ctx, "DELETE", &url, &api_key, None).await?
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

/// Returns `(path, jsonWrapperKey, listSuffix)` for each resource. Freshworks
/// wraps create/update bodies in the singular form (`{"contact": {...}}`) and
/// list endpoints need a `/view/<viewId>` or `/filters` suffix — we use the
/// generic `/filters` endpoint which lists available filters; the caller then
/// uses the returned `id` to actually query records. For default views we use
/// `view/all`.
fn resource_info(resource: &str) -> Option<(&'static str, &'static str, &'static str)> {
    match resource {
        "contact" => Some(("contacts", "contact", "filters")),
        "account" => Some(("sales_accounts", "sales_account", "filters")),
        "lead" => Some(("leads", "lead", "filters")),
        "deal" => Some(("deals", "deal", "filters")),
        "task" => Some(("tasks", "task", "filters")),
        "salesActivity" => Some(("sales_activities", "sales_activity", "filters")),
        _ => None,
    }
}

async fn freshworks_request(
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
        .header(reqwest::header::AUTHORIZATION, format!("Token token={api_key}"))
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
