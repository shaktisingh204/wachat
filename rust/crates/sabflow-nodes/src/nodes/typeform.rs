//! Typeform node.
//!
//! Implements form, response and workspace operations against the Typeform
//! REST API (https://api.typeform.com).  Authenticates via a Bearer personal
//! access token stored in the `typeformApi` credential.

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

pub struct TypeformNode;

const TYPEFORM_API_BASE: &str = "https://api.typeform.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TypeformNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "typeform",
            "Typeform",
            "Typeform online forms — manage forms, responses and workspaces",
            NodeCategory::Productivity,
        )
        .icon("clipboard-list")
        .color("#262627")
        .credentials(vec![CredentialBinding {
            name: "typeformApi".into(),
            display_name: "Typeform Personal Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Forms", "listForms"),
                    opt("Get Form", "getForm"),
                    opt("Create Form", "createForm"),
                    opt("Delete Form", "deleteForm"),
                    opt("Get Responses", "getResponses"),
                    opt("List Workspaces", "listWorkspaces"),
                ])
                .default(json!("listForms"))
                .required(),
            // Form id
            NodeProperty::new("formId", "Form ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["getForm", "deleteForm", "getResponses"],
                )
                .required(),
            // createForm
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["createForm"])
                .required(),
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .show_when("operation", &["createForm"])
                .description("JSON array of Typeform field definitions"),
            // getResponses
            NodeProperty::new("pageSize", "Page Size", NodePropertyType::Number)
                .show_when("operation", &["getResponses"])
                .description("Number of responses to return per page (max 1000)"),
            NodeProperty::new("since", "Since", NodePropertyType::String)
                .show_when("operation", &["getResponses"])
                .description("ISO-8601 timestamp — only return responses submitted after this time"),
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

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "listForms" => {
                send_request(ctx, &token, Method::Get, "/forms", None, &[]).await?
            }
            "getForm" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/forms/{form_id}");
                send_request(ctx, &token, Method::Get, &path, None, &[]).await?
            }
            "createForm" => {
                let title = ctx.param_str(params, "title")?;
                let mut payload = Map::new();
                payload.insert("title".into(), json!(title));
                if let Some(fields) = parse_json_param(ctx, params, "fields") {
                    payload.insert("fields".into(), fields);
                }
                send_request(
                    ctx,
                    &token,
                    Method::Post,
                    "/forms",
                    Some(Value::Object(payload)),
                    &[],
                )
                .await?
            }
            "deleteForm" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/forms/{form_id}");
                send_request(ctx, &token, Method::Delete, &path, None, &[]).await?
            }
            "getResponses" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/forms/{form_id}/responses");
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(ps) = ctx.param_f64(params, "pageSize") {
                    query.push(("page_size".into(), (ps as i64).to_string()));
                } else if let Some(ps) = ctx.param_str_opt(params, "pageSize") {
                    let trimmed = ps.trim();
                    if !trimmed.is_empty() {
                        query.push(("page_size".into(), trimmed.to_string()));
                    }
                }
                if let Some(since) = ctx.param_str_opt(params, "since") {
                    let trimmed = since.trim();
                    if !trimmed.is_empty() {
                        query.push(("since".into(), trimmed.to_string()));
                    }
                }
                send_request(ctx, &token, Method::Get, &path, None, &query).await?
            }
            "listWorkspaces" => {
                send_request(ctx, &token, Method::Get, "/workspaces", None, &[]).await?
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

#[derive(Clone, Copy)]
enum Method {
    Get,
    Post,
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    token: &str,
    method: Method,
    path: &str,
    payload: Option<Value>,
    query: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{TYPEFORM_API_BASE}{path}");
    let mut req = match method {
        Method::Get => ctx.http.get(&url),
        Method::Post => ctx.http.post(&url),
        Method::Delete => ctx.http.delete(&url),
    };
    req = req.bearer_auth(token);
    if !query.is_empty() {
        req = req.query(query);
    }
    if let Some(body) = payload {
        req = req.json(&body);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
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
