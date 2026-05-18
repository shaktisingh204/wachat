//! npm node — query the public npm registry (`https://registry.npmjs.org`) and
//! the npm search API (`https://registry.npmjs.org/-/v1/search`).
//!
//! Most operations are anonymous reads (no credential required). Authenticated
//! operations (e.g. `package:setDistTag`, `package:unpublish`) use a personal
//! access token stored on an optional `npmApi` credential under
//! `data["accessToken"]`, sent as `Authorization: Bearer <token>`.
//!
//! Supports:
//!   * Package: get (metadata), getVersion (specific version manifest),
//!     getVersions (list), search, getDistTags, setDistTag (auth)
//!   * Downloads: getPoint (download counts for a range)
//!   * User: getMe (auth)

use async_trait::async_trait;
use reqwest::{Method, RequestBuilder};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct NpmNode;

const REGISTRY: &str = "https://registry.npmjs.org";
const SEARCH: &str = "https://registry.npmjs.org/-/v1/search";
const DOWNLOADS: &str = "https://api.npmjs.org/downloads/point";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for NpmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "npm",
            "npm",
            "Query the npm registry and manage dist-tags",
            NodeCategory::Developer,
        )
        .icon("package")
        .color("#CB3837")
        .credentials(vec![CredentialBinding {
            name: "npmApi".into(),
            display_name: "npm API (optional)".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("Required only for write operations (setDistTag) and getMe"),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Package", "package"),
                    opt("Downloads", "downloads"),
                    opt("User", "user"),
                ])
                .default(json!("package"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Get Version", "getVersion"),
                    opt("Get Versions", "getVersions"),
                    opt("Search", "search"),
                    opt("Get Dist Tags", "getDistTags"),
                    opt("Set Dist Tag", "setDistTag"),
                    opt("Get Point", "getPoint"),
                    opt("Get Me", "getMe"),
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("packageName", "Package Name", NodePropertyType::String)
                .placeholder("react")
                .show_when("resource", &["package", "downloads"]),
            NodeProperty::new("version", "Version", NodePropertyType::String)
                .placeholder("18.0.0")
                .show_when("operation", &["getVersion", "setDistTag"]),
            NodeProperty::new("tag", "Dist Tag", NodePropertyType::String)
                .placeholder("latest")
                .show_when("operation", &["setDistTag"]),
            NodeProperty::new("query", "Search Query", NodePropertyType::String)
                .placeholder("react state management")
                .show_when("operation", &["search"]),
            NodeProperty::new("size", "Result Size", NodePropertyType::Number)
                .default(json!(20))
                .show_when("operation", &["search"]),
            NodeProperty::new("period", "Period", NodePropertyType::Options)
                .options(vec![
                    opt("Last Day", "last-day"),
                    opt("Last Week", "last-week"),
                    opt("Last Month", "last-month"),
                    opt("Last Year", "last-year"),
                ])
                .default(json!("last-week"))
                .show_when("operation", &["getPoint"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "package".to_string());
        let operation = ctx.param_str(params, "operation")?;

        // Bearer token is optional for most reads. Pulled lazily.
        let token: Option<String> = ctx
            .param_str_opt(params, "credentialId")
            .filter(|s| !s.trim().is_empty())
            .and_then(|id| {
                ctx.credentials
                    .get(&id)
                    .and_then(|c| c.data.get("accessToken").cloned())
            })
            .filter(|t| !t.is_empty());

        match (resource.as_str(), operation.as_str()) {
            // ─────────────────────────── Package ─────────────────────────────
            ("package", "get") => {
                let name = require_package(ctx, params)?;
                let url = format!("{REGISTRY}/{}", encode_package(&name));
                send(ctx, token.as_deref(), Method::GET, &url, None).await
            }
            ("package", "getVersion") => {
                let name = require_package(ctx, params)?;
                let version = require_param(ctx, params, "version")?;
                let url = format!(
                    "{REGISTRY}/{}/{}",
                    encode_package(&name),
                    urlencoding::encode(&version)
                );
                send(ctx, token.as_deref(), Method::GET, &url, None).await
            }
            ("package", "getVersions") => {
                let name = require_package(ctx, params)?;
                let url = format!("{REGISTRY}/{}", encode_package(&name));
                let raw = send_raw(ctx, token.as_deref(), Method::GET, &url, None).await?;
                // Extract just the `versions` keys so the caller doesn't have
                // to wade through the full manifest.
                let versions = raw
                    .get("versions")
                    .and_then(|v| v.as_object())
                    .map(|m| m.keys().cloned().collect::<Vec<_>>())
                    .unwrap_or_default();
                Ok(NodeOutput::single(vec![json!({
                    "name": name,
                    "versions": versions,
                })]))
            }
            ("package", "getDistTags") => {
                let name = require_package(ctx, params)?;
                let url = format!("{REGISTRY}/-/package/{}/dist-tags", encode_package(&name));
                send(ctx, token.as_deref(), Method::GET, &url, None).await
            }
            ("package", "setDistTag") => {
                let token = token
                    .ok_or_else(|| NodeError::MissingParameter("npm accessToken".into()))?;
                let name = require_package(ctx, params)?;
                let tag = require_param(ctx, params, "tag")?;
                let version = require_param(ctx, params, "version")?;
                let url = format!(
                    "{REGISTRY}/-/package/{}/dist-tags/{}",
                    encode_package(&name),
                    urlencoding::encode(&tag)
                );
                // PUT body is the bare version string per the npm spec.
                send_raw_string_body(
                    ctx,
                    &token,
                    Method::PUT,
                    &url,
                    format!("\"{version}\""),
                    "application/json",
                )
                .await
            }
            ("package", "search") => {
                let query = require_param(ctx, params, "query")?;
                let size = ctx
                    .param_f64(params, "size")
                    .map(|n| n as u32)
                    .unwrap_or(20);
                let url = format!(
                    "{SEARCH}?text={}&size={size}",
                    urlencoding::encode(&query)
                );
                let raw = send_raw(ctx, token.as_deref(), Method::GET, &url, None).await?;
                let items = raw
                    .get("objects")
                    .cloned()
                    .and_then(|v| match v {
                        Value::Array(a) => Some(a),
                        _ => None,
                    })
                    .unwrap_or_default();
                Ok(NodeOutput::single(items))
            }

            // ────────────────────────── Downloads ────────────────────────────
            ("downloads", "getPoint") => {
                let name = require_package(ctx, params)?;
                let period = ctx
                    .param_str_opt(params, "period")
                    .unwrap_or_else(|| "last-week".to_string());
                let url = format!("{DOWNLOADS}/{period}/{}", encode_package(&name));
                send(ctx, token.as_deref(), Method::GET, &url, None).await
            }

            // ──────────────────────────── User ───────────────────────────────
            ("user", "getMe") => {
                let token = token
                    .ok_or_else(|| NodeError::MissingParameter("npm accessToken".into()))?;
                let url = format!("{REGISTRY}/-/whoami");
                send(ctx, Some(token.as_str()), Method::GET, &url, None).await
            }

            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported {r}:{o}"),
            }),
        }
    }
}

fn require_param(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

fn require_package(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    require_param(ctx, params, "packageName")
}

/// Encode a package name for use as a URL path segment.
///
/// npm registry paths accept scoped packages either as `@scope/name` (where
/// the `/` is literal) or as `@scope%2fname` (URL-encoded). We use the
/// encoded form by URL-encoding the entire name as a single segment.
fn encode_package(name: &str) -> String {
    urlencoding::encode(name).into_owned()
}

async fn send(
    ctx: &ExecutionContext,
    token: Option<&str>,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let parsed = send_raw(ctx, token, method, url, body).await?;
    let items = match parsed {
        Value::Array(a) => a,
        Value::Null => vec![],
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}

async fn send_raw(
    ctx: &ExecutionContext,
    token: Option<&str>,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<Value> {
    let mut req: RequestBuilder = ctx
        .http
        .request(method, url)
        .header("Accept", "application/json");
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    let parsed: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes).unwrap_or_else(|_| {
            Value::String(String::from_utf8_lossy(&bytes).into_owned())
        })
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: match &parsed {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            },
        });
    }
    Ok(parsed)
}

async fn send_raw_string_body(
    ctx: &ExecutionContext,
    token: &str,
    method: Method,
    url: &str,
    body: String,
    content_type: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx
        .http
        .request(method, url)
        .bearer_auth(token)
        .header("Content-Type", content_type)
        .body(body)
        .send()
        .await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    let parsed: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes).unwrap_or_else(|_| {
            Value::String(String::from_utf8_lossy(&bytes).into_owned())
        })
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: match &parsed {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            },
        });
    }
    let items = match parsed {
        Value::Null => vec![json!({ "status": status.as_u16() })],
        Value::Array(a) => a,
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
