//! Affinity node.
//!
//! Implements CRUD operations against the Affinity v1 REST API
//! (https://api.affinity.co). Affinity uses HTTP Basic Auth with an empty
//! username and the API key as the password — supplied via the `affinityApi`
//! credential (`apiKey` field).
//!
//! Resources covered: person, organization, opportunity, list, list_entry, note.

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

pub struct AffinityNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for AffinityNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "affinity",
            "Affinity",
            "Manage Affinity relationship-intelligence CRM records, lists and notes",
            NodeCategory::Crm,
        )
        .icon("network")
        .color("#1A2A3A")
        .credentials(vec![CredentialBinding {
            name: "affinityApi".into(),
            display_name: "Affinity API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Person", "person"),
                    opt("Organization", "organization"),
                    opt("Opportunity", "opportunity"),
                    opt("List", "list"),
                    opt("List Entry", "listEntry"),
                    opt("Note", "note"),
                ])
                .default(json!("person"))
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
                .placeholder("12345")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .placeholder("67890")
                .show_when("resource", &["listEntry"])
                .description("Parent list id for list-entry operations")
                .required(),
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"first_name\": \"Jane\", \"last_name\": \"Doe\", \"emails\": [\"jane@example.com\"] }")
                .show_when("operation", &["create", "update"])
                .description("Record fields as a JSON object"),
            NodeProperty::new("limit", "Page Size", NodePropertyType::Number)
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "person".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let base_url = "https://api.affinity.co".to_string();

        // list_entry paths are scoped under their parent list:
        //   /lists/{list_id}/list-entries/{entry_id?}
        let path = if resource == "listEntry" {
            let list_id = ctx.param_str(params, "listId")?;
            let list_id = ctx.substitute(&list_id);
            format!("lists/{list_id}/list-entries")
        } else {
            resource_path(&resource)
                .ok_or_else(|| NodeError::InvalidParameter {
                    name: "resource".into(),
                    reason: format!("unknown resource: {resource}"),
                })?
                .to_string()
        };

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}");
                affinity_request(ctx, "POST", &url, &api_key, Some(payload)).await?
            }
            "get" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                affinity_request(ctx, "GET", &url, &api_key, None).await?
            }
            "getAll" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u64)
                    .unwrap_or(100);
                let url = format!("{base_url}/{path}?page_size={limit}");
                affinity_request(ctx, "GET", &url, &api_key, None).await?
            }
            "update" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{base_url}/{path}/{id}");
                affinity_request(ctx, "PUT", &url, &api_key, Some(payload)).await?
            }
            "delete" => {
                let id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&id);
                let url = format!("{base_url}/{path}/{id}");
                affinity_request(ctx, "DELETE", &url, &api_key, None).await?
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
        "person" => Some("persons"),
        "organization" => Some("organizations"),
        "opportunity" => Some("opportunities"),
        "list" => Some("lists"),
        "note" => Some("notes"),
        _ => None,
    }
}

async fn affinity_request(
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
        .basic_auth("", Some(api_key))
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
