//! GitHub node — repository, issue, pull request, release, and user operations
//! against the GitHub REST API (https://api.github.com).
//!
//! Authentication uses a personal access token stored on a `githubApi`
//! credential under `data["accessToken"]`, sent as `Authorization: token <token>`.

use async_trait::async_trait;
use reqwest::{Method, RequestBuilder};
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

pub struct GithubNode;

const API_BASE: &str = "https://api.github.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GithubNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "github",
            "GitHub",
            "GitHub repository operations",
            NodeCategory::Developer,
        )
        .icon("github")
        .color("#181717")
        .credentials(vec![CredentialBinding {
            name: "githubApi".into(),
            display_name: "GitHub API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Issue", "issue"),
                    opt("Pull Request", "pullRequest"),
                    opt("Repository", "repository"),
                    opt("Release", "release"),
                    opt("User", "user"),
                ])
                .default(json!("issue"))
                .required(),
            // Operation — superset of all per-resource operations.  The frontend
            // typically filters these based on the chosen resource, but we keep
            // the full list here so any combination round-trips.
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Edit", "edit"),
                    opt("Close", "close"),
                    opt("Lock", "lock"),
                    opt("Merge", "merge"),
                    opt("Delete", "delete"),
                    opt("Get Issues", "getIssues"),
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("owner", "Owner", NodePropertyType::String)
                .placeholder("octocat")
                .required(),
            NodeProperty::new("repository", "Repository", NodePropertyType::String)
                .placeholder("Hello-World")
                .required(),
            NodeProperty::new("issueNumber", "Issue / PR Number", NodePropertyType::Number)
                .show_when("operation", &["get", "edit", "close", "lock", "merge"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["create", "edit"]),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .show_when("operation", &["create", "edit"]),
            NodeProperty::new("labels", "Labels", NodePropertyType::Json)
                .default(json!([]))
                .show_when("operation", &["create", "edit"])
                .description("JSON array of label names"),
            NodeProperty::new("state", "State", NodePropertyType::Options)
                .options(vec![
                    opt("Open", "open"),
                    opt("Closed", "closed"),
                    opt("All", "all"),
                ])
                .default(json!("open"))
                .show_when("operation", &["getAll"]),
            NodeProperty::new("head", "Head Branch", NodePropertyType::String)
                .placeholder("feature-branch")
                .show_when("operation", &["create"]),
            NodeProperty::new("base", "Base Branch", NodePropertyType::String)
                .placeholder("main")
                .show_when("operation", &["create"]),
            NodeProperty::new("tagName", "Tag Name", NodePropertyType::String)
                .placeholder("v1.0.0")
                .show_when("operation", &["create"]),
            NodeProperty::new("releaseId", "Release ID", NodePropertyType::Number)
                .show_when("operation", &["get", "delete"]),
            NodeProperty::new("username", "Username", NodePropertyType::String)
                .show_when("resource", &["user"]),
            NodeProperty::new("org", "Organization", NodePropertyType::String)
                .show_when("resource", &["user"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // --- credential ---
        let cred_id = ctx.param_str(params, "credentialId")?;
        let token = ctx
            .credential(&cred_id)?
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "issue".to_string());
        let operation = ctx.param_str(params, "operation")?;

        // --- common params (substituted) ---
        let owner = sub_required(ctx, params, "owner")?;
        // Repository is required for everything except `user:*`.
        let repository = if resource == "user" {
            ctx.param_str_opt(params, "repository")
                .map(|s| ctx.substitute(&s))
                .unwrap_or_default()
        } else {
            sub_required(ctx, params, "repository")?
        };

        match (resource.as_str(), operation.as_str()) {
            // ───────────────────────────── Issue ─────────────────────────────
            ("issue", "create") => {
                let title = sub_required(ctx, params, "title")?;
                let body = ctx
                    .param_str_opt(params, "body")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();
                let labels = collect_labels(ctx, params);
                let mut payload = Map::new();
                payload.insert("title".into(), json!(title));
                if !body.is_empty() {
                    payload.insert("body".into(), json!(body));
                }
                if !labels.is_empty() {
                    payload.insert("labels".into(), json!(labels));
                }
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues");
                send_json(
                    ctx,
                    &token,
                    Method::POST,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await
            }
            ("issue", "get") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues/{n}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("issue", "getAll") => {
                let state = ctx
                    .param_str_opt(params, "state")
                    .unwrap_or_else(|| "open".to_string());
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues?state={state}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("issue", "edit") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let mut payload = Map::new();
                if let Some(t) = ctx.param_str_opt(params, "title") {
                    let t = ctx.substitute(&t);
                    if !t.is_empty() {
                        payload.insert("title".into(), json!(t));
                    }
                }
                if let Some(b) = ctx.param_str_opt(params, "body") {
                    let b = ctx.substitute(&b);
                    if !b.is_empty() {
                        payload.insert("body".into(), json!(b));
                    }
                }
                let labels = collect_labels(ctx, params);
                if !labels.is_empty() {
                    payload.insert("labels".into(), json!(labels));
                }
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues/{n}");
                send_json(
                    ctx,
                    &token,
                    Method::PATCH,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await
            }
            ("issue", "close") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues/{n}");
                send_json(
                    ctx,
                    &token,
                    Method::PATCH,
                    &url,
                    Some(json!({ "state": "closed" })),
                )
                .await
            }
            ("issue", "lock") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues/{n}/lock");
                send_json(ctx, &token, Method::PUT, &url, Some(json!({}))).await
            }

            // ───────────────────────── Pull Request ──────────────────────────
            ("pullRequest", "create") => {
                let title = sub_required(ctx, params, "title")?;
                let head = sub_required(ctx, params, "head")?;
                let base = sub_required(ctx, params, "base")?;
                let body = ctx
                    .param_str_opt(params, "body")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();
                let mut payload = Map::new();
                payload.insert("title".into(), json!(title));
                payload.insert("head".into(), json!(head));
                payload.insert("base".into(), json!(base));
                if !body.is_empty() {
                    payload.insert("body".into(), json!(body));
                }
                let url = format!("{API_BASE}/repos/{owner}/{repository}/pulls");
                send_json(
                    ctx,
                    &token,
                    Method::POST,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await
            }
            ("pullRequest", "get") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/pulls/{n}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("pullRequest", "getAll") => {
                let url = format!("{API_BASE}/repos/{owner}/{repository}/pulls");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("pullRequest", "merge") => {
                let n = require_number(ctx, params, "issueNumber")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/pulls/{n}/merge");
                send_json(ctx, &token, Method::PUT, &url, Some(json!({}))).await
            }

            // ───────────────────────── Repository ────────────────────────────
            ("repository", "get") => {
                let url = format!("{API_BASE}/repos/{owner}/{repository}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("repository", "getAll") => {
                let url = format!("{API_BASE}/user/repos");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("repository", "getIssues") => {
                let url = format!("{API_BASE}/repos/{owner}/{repository}/issues");
                send_json(ctx, &token, Method::GET, &url, None).await
            }

            // ─────────────────────────── Release ─────────────────────────────
            ("release", "create") => {
                let tag_name = sub_required(ctx, params, "tagName")?;
                let title = ctx
                    .param_str_opt(params, "title")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();
                let body = ctx
                    .param_str_opt(params, "body")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();
                let mut payload = Map::new();
                payload.insert("tag_name".into(), json!(tag_name));
                if !title.is_empty() {
                    payload.insert("name".into(), json!(title));
                }
                if !body.is_empty() {
                    payload.insert("body".into(), json!(body));
                }
                let url = format!("{API_BASE}/repos/{owner}/{repository}/releases");
                send_json(
                    ctx,
                    &token,
                    Method::POST,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await
            }
            ("release", "get") => {
                let id = require_number(ctx, params, "releaseId")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/releases/{id}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("release", "getAll") => {
                let url = format!("{API_BASE}/repos/{owner}/{repository}/releases");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("release", "delete") => {
                let id = require_number(ctx, params, "releaseId")?;
                let url = format!("{API_BASE}/repos/{owner}/{repository}/releases/{id}");
                send_json(ctx, &token, Method::DELETE, &url, None).await
            }

            // ───────────────────────────── User ──────────────────────────────
            ("user", "get") => {
                let username = sub_required(ctx, params, "username")?;
                let url = format!("{API_BASE}/users/{username}");
                send_json(ctx, &token, Method::GET, &url, None).await
            }
            ("user", "getAll") => {
                let org = sub_required(ctx, params, "org")?;
                let url = format!("{API_BASE}/orgs/{org}/members");
                send_json(ctx, &token, Method::GET, &url, None).await
            }

            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported {r}:{o}"),
            }),
        }
    }
}

/// Fetch a required user-supplied string param and substitute `{{var}}`.
fn sub_required(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

fn require_number(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<i64> {
    if let Some(n) = ctx.param_f64(params, key) {
        return Ok(n as i64);
    }
    if let Some(s) = ctx.param_str_opt(params, key) {
        let s = ctx.substitute(&s);
        if let Ok(n) = s.trim().parse::<i64>() {
            return Ok(n);
        }
    }
    Err(NodeError::MissingParameter(key.to_string()))
}

/// Pull labels from the `labels` param.  Accepts an array or a JSON-encoded
/// string; substitutes `{{var}}` in each entry; drops empty / non-string values.
fn collect_labels(ctx: &ExecutionContext, params: &Value) -> Vec<String> {
    let Some(raw) = params.get("labels") else {
        return Vec::new();
    };
    let arr = match raw {
        Value::Array(a) => a.clone(),
        Value::String(s) => {
            let s = ctx.substitute(s);
            if s.trim().is_empty() {
                return Vec::new();
            }
            match serde_json::from_str::<Value>(&s) {
                Ok(Value::Array(a)) => a,
                _ => return Vec::new(),
            }
        }
        _ => return Vec::new(),
    };
    arr.into_iter()
        .filter_map(|v| match v {
            Value::String(s) => {
                let s = ctx.substitute(&s);
                if s.trim().is_empty() { None } else { Some(s) }
            }
            other => {
                let s = other.to_string();
                if s.trim().is_empty() { None } else { Some(s) }
            }
        })
        .collect()
}

/// Build the GitHub-flavored request, run it, parse JSON, propagate non-2xx.
async fn send_json(
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
        .header("User-Agent", "sabflow")
        .header("Accept", "application/vnd.github+json");
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    let parsed: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
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
        Value::Array(arr) => arr,
        Value::Null => vec![],
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
