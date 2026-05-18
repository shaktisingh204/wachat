//! Agile CRM node.
//!
//! Implements CRUD operations against the Agile CRM REST API
//! (https://{subdomain}.agilecrm.com/dev/api). Agile CRM authenticates with
//! HTTP Basic Auth — the user's email as username and their API key as the
//! password — supplied via the `agileCrmApi` credential (`email`, `apiKey`,
//! `subdomain` fields).
//!
//! Resources covered: contact, company, deal, task.

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

pub struct AgileCrmNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for AgileCrmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "agileCrm",
            "Agile CRM",
            "Manage Agile CRM contacts, companies, deals and tasks",
            NodeCategory::Crm,
        )
        .icon("users")
        .color("#2A87D0")
        .credentials(vec![CredentialBinding {
            name: "agileCrmApi".into(),
            display_name: "Agile CRM API".into(),
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
                    opt("Task", "task"),
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
                .placeholder("5723280219045888")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"first_name\": \"Jane\", \"last_name\": \"Doe\", \"email\": \"jane@example.com\" }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object"),
            NodeProperty::new("limit", "Page Size", NodePropertyType::Number)
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
        let email = cred
            .data
            .get("email")
            .ok_or_else(|| NodeError::MissingParameter("email".into()))?
            .clone();
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();
        let subdomain = cred
            .data
            .get("subdomain")
            .ok_or_else(|| NodeError::MissingParameter("subdomain".into()))?
            .trim_end_matches('/')
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "contact".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let info = resource_info(&resource).ok_or_else(|| NodeError::InvalidParameter {
            name: "resource".into(),
            reason: format!("unknown resource: {resource}"),
        })?;

        let api_base = format!("https://{subdomain}.agilecrm.com/dev/api");

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/{}", info.create_path);
                agile_request(ctx, "POST", &url, &email, &api_key, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{}/{id}", info.item_path);
                agile_request(ctx, "GET", &url, &email, &api_key, None).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(25);
                let url = format!("{api_base}/{}?page_size={limit}", info.list_path);
                agile_request(ctx, "GET", &url, &email, &api_key, None).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let mut payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                // Agile CRM update endpoint expects the id inside the body.
                if let Value::Object(ref mut map) = payload {
                    let id_for_body = id.clone();
                    map.entry("id".to_string())
                        .or_insert_with(|| json!(id_for_body));
                }
                let url = format!("{api_base}/{}", info.update_path);
                agile_request(ctx, "PUT", &url, &email, &api_key, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{api_base}/{}/{id}", info.item_path);
                agile_request(ctx, "DELETE", &url, &email, &api_key, None).await?
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

struct ResourceInfo {
    /// POST endpoint for creating a record.
    create_path: &'static str,
    /// GET-by-id and DELETE-by-id share this path.
    item_path: &'static str,
    /// PUT endpoint for updating a record.
    update_path: &'static str,
    /// GET endpoint for listing records.
    list_path: &'static str,
}

fn resource_info(resource: &str) -> Option<ResourceInfo> {
    match resource {
        "contact" => Some(ResourceInfo {
            create_path: "contacts",
            item_path: "contacts",
            update_path: "contacts/edit-properties",
            list_path: "contacts",
        }),
        "company" => Some(ResourceInfo {
            create_path: "contacts",
            item_path: "contacts",
            update_path: "contacts/edit-properties",
            list_path: "contacts/companies/list",
        }),
        "deal" => Some(ResourceInfo {
            create_path: "opportunity",
            item_path: "opportunity",
            update_path: "opportunity/partial-update",
            list_path: "opportunity",
        }),
        "task" => Some(ResourceInfo {
            create_path: "tasks",
            item_path: "tasks",
            update_path: "tasks/partial-update",
            list_path: "tasks",
        }),
        _ => None,
    }
}

async fn agile_request(
    ctx: &ExecutionContext,
    method: &str,
    url: &str,
    email: &str,
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
        .basic_auth(email, Some(api_key))
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
