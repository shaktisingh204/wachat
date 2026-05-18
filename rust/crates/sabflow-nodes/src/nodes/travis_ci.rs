//! Travis CI node — operations against the Travis CI v3 REST API.
//!
//! The Travis credential carries:
//!   * `apiToken` — Travis personal access token, sent as
//!     `Authorization: token <token>` (note: literal `token`, not `Bearer`).
//!   * `baseUrl` (optional) — defaults to `https://api.travis-ci.com`; can be
//!     `https://api.travis-ci.org` (legacy OSS) or a Travis Enterprise URL.
//!
//! Travis v3 requires the `Travis-API-Version: 3` header on every request.
//!
//! Supports:
//!   * Repo: get, getAll, activate, deactivate
//!   * Build: get, getAll (by repo), cancel, restart
//!   * Job: get, cancel, restart
//!   * User: getMe

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

pub struct TravisCiNode;

const DEFAULT_BASE: &str = "https://api.travis-ci.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TravisCiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "travisCi",
            "Travis CI",
            "Inspect repos and control builds on Travis CI",
            NodeCategory::Developer,
        )
        .icon("activity")
        .color("#3EAAAF")
        .credentials(vec![CredentialBinding {
            name: "travisCiApi".into(),
            display_name: "Travis CI API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Repo", "repo"),
                    opt("Build", "build"),
                    opt("Job", "job"),
                    opt("User", "user"),
                ])
                .default(json!("repo"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Activate", "activate"),
                    opt("Deactivate", "deactivate"),
                    opt("Cancel", "cancel"),
                    opt("Restart", "restart"),
                    opt("Get Me", "getMe"),
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("repoSlug", "Repo Slug", NodePropertyType::String)
                .placeholder("my-org/my-repo")
                .show_when("resource", &["repo", "build"]),
            // buildId is shared by build:get|cancel|restart; gate by operation
            // since show_when can only encode one predicate.
            NodeProperty::new("buildId", "Build ID", NodePropertyType::String)
                .show_when("operation", &["get", "cancel", "restart"]),
            NodeProperty::new("jobId", "Job ID", NodePropertyType::String)
                .show_when("resource", &["job"]),
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
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();
        let base = cred
            .data
            .get("baseUrl")
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE.to_string());

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "repo".to_string());
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ──────────────────────────── Repo ─────────────────────────────
            ("repo", "get") => {
                let slug = require_slug(ctx, params)?;
                let url = format!("{base}/repo/{}", urlencoding::encode(&slug));
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("repo", "getAll") => {
                let url = format!("{base}/repos");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("repo", "activate") => {
                let slug = require_slug(ctx, params)?;
                let url =
                    format!("{base}/repo/{}/activate", urlencoding::encode(&slug));
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }
            ("repo", "deactivate") => {
                let slug = require_slug(ctx, params)?;
                let url =
                    format!("{base}/repo/{}/deactivate", urlencoding::encode(&slug));
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }

            // ──────────────────────────── Build ────────────────────────────
            ("build", "get") => {
                let id = require_param(ctx, params, "buildId")?;
                let url = format!("{base}/build/{id}");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("build", "getAll") => {
                let slug = require_slug(ctx, params)?;
                let url = format!("{base}/repo/{}/builds", urlencoding::encode(&slug));
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("build", "cancel") => {
                let id = require_param(ctx, params, "buildId")?;
                let url = format!("{base}/build/{id}/cancel");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }
            ("build", "restart") => {
                let id = require_param(ctx, params, "buildId")?;
                let url = format!("{base}/build/{id}/restart");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }

            // ───────────────────────────── Job ─────────────────────────────
            ("job", "get") => {
                let id = require_param(ctx, params, "jobId")?;
                let url = format!("{base}/job/{id}");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("job", "cancel") => {
                let id = require_param(ctx, params, "jobId")?;
                let url = format!("{base}/job/{id}/cancel");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }
            ("job", "restart") => {
                let id = require_param(ctx, params, "jobId")?;
                let url = format!("{base}/job/{id}/restart");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }

            // ──────────────────────────── User ─────────────────────────────
            ("user", "getMe") => {
                let url = format!("{base}/user");
                send(ctx, &token, Method::GET, &url, None).await
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

fn require_slug(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    require_param(ctx, params, "repoSlug")
}

async fn send(
    ctx: &ExecutionContext,
    token: &str,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let mut req: RequestBuilder = ctx
        .http
        .request(method, url)
        .header("Authorization", format!("token {token}"))
        .header("Travis-API-Version", "3")
        .header("Accept", "application/json");
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
    // Travis v3 wraps collections like `{ "@type": "repositories", "repositories": [...] }`
    // — pull out the array under any key whose value is a JSON array (after
    // dropping `@`-prefixed metadata keys).
    let items = match parsed {
        Value::Array(a) => a,
        Value::Null => vec![],
        Value::Object(ref map) => {
            let collection = map.iter().find(|(k, v)| {
                !k.starts_with('@') && matches!(**v, Value::Array(_))
            });
            match collection.and_then(|(_, v)| v.as_array().cloned()) {
                Some(a) => a,
                None => vec![parsed],
            }
        }
    };
    Ok(NodeOutput::single(items))
}
