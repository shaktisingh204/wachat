//! urlscan.io node.
//!
//! Submit URLs for scanning and retrieve scan results / search via the
//! urlscan.io REST API (https://urlscan.io/api/v1). Authenticates with the
//! `API-Key` header supplied through the `urlScanIoApi` credential
//! (`apiKey` field).
//!
//! Screenshot binaries returned by urlscan.io are referenced by URL inside
//! `mediaRef`, never inlined as base64.

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

pub struct UrlScanIoNode;

const URLSCAN_API_BASE: &str = "https://urlscan.io/api/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for UrlScanIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "urlScanIo",
            "urlscan.io",
            "Submit URLs for scanning and retrieve scan results",
            NodeCategory::Developer,
        )
        .icon("search")
        .color("#0EA5E9")
        .credentials(vec![CredentialBinding {
            name: "urlScanIoApi".into(),
            display_name: "urlscan.io API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Submit Scan", "scan"),
                    opt("Get Result", "result"),
                    opt("Search", "search"),
                ])
                .default(json!("scan"))
                .required(),
            NodeProperty::new("url", "URL", NodePropertyType::String)
                .placeholder("https://example.com")
                .show_when("operation", &["scan"])
                .required(),
            NodeProperty::new("visibility", "Visibility", NodePropertyType::Options)
                .options(vec![
                    opt("Public", "public"),
                    opt("Unlisted", "unlisted"),
                    opt("Private", "private"),
                ])
                .default(json!("public"))
                .show_when("operation", &["scan"]),
            NodeProperty::new("tags", "Tags", NodePropertyType::Json)
                .show_when("operation", &["scan"])
                .description("Optional JSON array of tag strings"),
            NodeProperty::new("scanUuid", "Scan UUID", NodePropertyType::String)
                .placeholder("00000000-0000-0000-0000-000000000000")
                .show_when("operation", &["result"])
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("domain:example.com")
                .show_when("operation", &["search"])
                .required(),
            NodeProperty::new("size", "Result Size", NodePropertyType::Number)
                .default(json!(100))
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "scan" => {
                let target_url = ctx.param_str(params, "url")?;
                let visibility = ctx
                    .param_str_opt(params, "visibility")
                    .unwrap_or_else(|| "public".to_string());
                let mut payload = Map::new();
                payload.insert("url".into(), json!(target_url));
                payload.insert("visibility".into(), json!(visibility));
                if let Some(tags) = parse_json_param(ctx, params, "tags") {
                    payload.insert("tags".into(), tags);
                }
                post_json(ctx, &api_key, "scan/", Value::Object(payload)).await?
            }
            "result" => {
                let uuid = ctx.param_str(params, "scanUuid")?;
                let raw = get_json(ctx, &api_key, &format!("result/{uuid}/")).await?;
                attach_screenshot_ref(raw)
            }
            "search" => {
                let query = ctx.param_str(params, "query")?;
                let size = ctx.param_f64(params, "size").unwrap_or(100.0) as i64;
                let url = format!(
                    "{URLSCAN_API_BASE}/search/?q={}&size={size}",
                    urlencoding::encode(&query)
                );
                let res = ctx.http.get(&url).header("API-Key", &api_key).send().await?;
                finalize(res).await?
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

/// urlscan.io results include `task.screenshotURL` and `task.domURL`. Surface
/// them as a normalised `mediaRef` so binary downloads stay URL-only.
fn attach_screenshot_ref(mut body: Value) -> Value {
    let shot = body
        .get("task")
        .and_then(|t| t.get("screenshotURL"))
        .cloned()
        .unwrap_or(Value::Null);
    let dom = body
        .get("task")
        .and_then(|t| t.get("domURL"))
        .cloned()
        .unwrap_or(Value::Null);
    if let Value::Object(map) = &mut body {
        map.insert(
            "mediaRef".into(),
            json!({
                "screenshot": { "kind": "url", "mimeType": "image/png", "url": shot },
                "dom":        { "kind": "url", "mimeType": "text/html",  "url": dom  },
            }),
        );
    }
    body
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{URLSCAN_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .header("API-Key", api_key)
        .json(&payload)
        .send()
        .await?;
    finalize(res).await
}

async fn get_json(ctx: &ExecutionContext, api_key: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{URLSCAN_API_BASE}/{endpoint}");
    let res = ctx.http.get(&url).header("API-Key", api_key).send().await?;
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
