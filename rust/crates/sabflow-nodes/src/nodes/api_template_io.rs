//! APITemplate.io node.
//!
//! Render PDFs and images from preconfigured templates using the
//! APITemplate.io REST API (https://rest.apitemplate.io/v2). Authenticates
//! via the `X-API-KEY` header supplied through the `apiTemplateIoApi`
//! credential (`apiKey` field).
//!
//! The node returns the rendered file as a URL reference inside `mediaRef`
//! — it does not inline binary base64.

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

pub struct ApiTemplateIoNode;

const APITEMPLATE_API_BASE: &str = "https://rest.apitemplate.io/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ApiTemplateIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "apiTemplateIo",
            "APITemplate.io",
            "Render PDFs and images from APITemplate.io templates",
            NodeCategory::Developer,
        )
        .icon("file-text")
        .color("#0EA5E9")
        .credentials(vec![CredentialBinding {
            name: "apiTemplateIoApi".into(),
            display_name: "APITemplate.io API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("PDF", "pdf"),
                    opt("Image", "image"),
                    opt("Account", "account"),
                ])
                .default(json!("pdf"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create")])
                .default(json!("create"))
                .show_when("resource", &["pdf", "image"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get Info", "getInfo"),
                    opt("List Templates", "listTemplates"),
                ])
                .default(json!("getInfo"))
                .show_when("resource", &["account"])
                .required(),
            NodeProperty::new("templateId", "Template ID", NodePropertyType::String)
                .placeholder("12345abcde")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("data", "Template Data", NodePropertyType::Json)
                .show_when("operation", &["create"])
                .description("JSON object of placeholder→value pairs"),
            NodeProperty::new("exportType", "Export Type", NodePropertyType::Options)
                .options(vec![
                    opt("File (URL)", "file"),
                    opt("JSON metadata", "json"),
                ])
                .default(json!("file"))
                .show_when("operation", &["create"])
                .description("APITemplate response shape — `file` returns download_url"),
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
            .unwrap_or_else(|| "pdf".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let result: Value = match (resource.as_str(), operation.as_str()) {
            ("pdf", "create") | ("image", "create") => {
                let template_id = ctx.param_str(params, "templateId")?;
                let data = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let export = ctx
                    .param_str_opt(params, "exportType")
                    .unwrap_or_else(|| "file".to_string());

                let endpoint = match resource.as_str() {
                    "pdf" => "create-pdf",
                    "image" => "create-image",
                    _ => unreachable!(),
                };
                let query = vec![
                    ("template_id".to_string(), template_id),
                    ("export_type".to_string(), export),
                ];
                let body = post_json(ctx, &api_key, endpoint, &query, data).await?;
                file_summary(&resource, body)
            }
            ("account", "getInfo") => get_json(ctx, &api_key, "account-information").await?,
            ("account", "listTemplates") => get_json(ctx, &api_key, "list-templates").await?,
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![result]))
    }
}

/// Normalise an APITemplate render response: the `download_url` is the
/// canonical URL reference and the upstream payload is preserved under `raw`.
fn file_summary(resource: &str, body: Value) -> Value {
    let url = body
        .get("download_url")
        .cloned()
        .or_else(|| body.get("download_url_png").cloned())
        .unwrap_or(Value::Null);
    let mime = match resource {
        "pdf" => "application/pdf",
        "image" => "image/png",
        _ => "application/octet-stream",
    };
    json!({
        "transactionRef": body.get("transaction_ref").cloned().unwrap_or(Value::Null),
        "status": body.get("status").cloned().unwrap_or(Value::Null),
        "mediaRef": {
            "kind": "url",
            "mimeType": mime,
            "url": url,
        },
        "raw": body,
    })
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    query: &[(String, String)],
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{APITEMPLATE_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .header("X-API-KEY", api_key)
        .query(query)
        .json(&payload)
        .send()
        .await?;
    finalize(res).await
}

async fn get_json(ctx: &ExecutionContext, api_key: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{APITEMPLATE_API_BASE}/{endpoint}");
    let res = ctx.http.get(&url).header("X-API-KEY", api_key).send().await?;
    finalize(res).await
}

async fn finalize(res: reqwest::Response) -> NodeResult<Value> {
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
