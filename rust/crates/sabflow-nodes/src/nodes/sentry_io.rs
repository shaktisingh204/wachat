//! Sentry.io node — issue and event monitoring against the Sentry REST API
//! (`https://sentry.io/api/0/`, or a self-hosted base URL).
//!
//! Authentication uses a Sentry auth token (org-level Internal Integration or
//! a User Auth Token) stored on a `sentryIoApi` credential under
//! `data["accessToken"]`, sent as `Authorization: Bearer <token>`.
//!
//! Supports the most common operations:
//!   * Issue: get, list (by project), update (resolve / ignore / assign), delete
//!   * Event: get, list (by project)
//!   * Project: list
//!   * Release: create, list (by org)
//!
//! All responses are returned as `NodeOutput::single` — list endpoints flatten
//! the array into items, single-object endpoints emit a one-item array.

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

pub struct SentryIoNode;

const DEFAULT_BASE: &str = "https://sentry.io/api/0";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SentryIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sentryIo",
            "Sentry.io",
            "Manage issues, events, and releases on Sentry",
            NodeCategory::Developer,
        )
        .icon("alert-triangle")
        .color("#362D59")
        .credentials(vec![CredentialBinding {
            name: "sentryIoApi".into(),
            display_name: "Sentry.io API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Issue", "issue"),
                    opt("Event", "event"),
                    opt("Project", "project"),
                    opt("Release", "release"),
                ])
                .default(json!("issue"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Create", "create"),
                ])
                .default(json!("getAll"))
                .required(),
            NodeProperty::new(
                "organizationSlug",
                "Organization Slug",
                NodePropertyType::String,
            )
            .placeholder("my-org")
            .description("Sentry organization slug — required for most operations"),
            NodeProperty::new("projectSlug", "Project Slug", NodePropertyType::String)
                .placeholder("my-project")
                .show_when("resource", &["issue", "event"]),
            NodeProperty::new("issueId", "Issue ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete"]),
            NodeProperty::new("eventId", "Event ID", NodePropertyType::String)
                .show_when("resource", &["event"]),
            NodeProperty::new("status", "New Status", NodePropertyType::Options)
                .options(vec![
                    opt("Resolved", "resolved"),
                    opt("Unresolved", "unresolved"),
                    opt("Ignored", "ignored"),
                ])
                .default(json!("resolved"))
                .show_when("operation", &["update"]),
            NodeProperty::new("assignedTo", "Assigned To", NodePropertyType::String)
                .show_when("operation", &["update"])
                .description("Sentry username or team slug to assign — optional"),
            NodeProperty::new("version", "Release Version", NodePropertyType::String)
                .placeholder("frontend@1.0.0")
                .show_when("resource", &["release"]),
            NodeProperty::new("releaseProjects", "Release Projects", NodePropertyType::Json)
                .default(json!([]))
                .show_when("resource", &["release"])
                .description("JSON array of project slugs the release applies to"),
            NodeProperty::new("query", "Search Query", NodePropertyType::String)
                .show_when("operation", &["getAll"])
                .description("Sentry search query (e.g. `is:unresolved`) — optional"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();
        let base = cred
            .data
            .get("baseUrl")
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE.to_string());

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "issue".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let org = ctx.param_str_opt(params, "organizationSlug").unwrap_or_default();
        let project = ctx.param_str_opt(params, "projectSlug").unwrap_or_default();

        match (resource.as_str(), operation.as_str()) {
            // ───────────────────────────── Issue ─────────────────────────────
            ("issue", "get") => {
                let id = require_param(ctx, params, "issueId")?;
                let url = format!("{base}/issues/{id}/");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("issue", "getAll") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let project = require_non_empty(&project, "projectSlug")?;
                let mut url = format!("{base}/projects/{org}/{project}/issues/?");
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u32)
                    .unwrap_or(100);
                url.push_str(&format!("limit={limit}"));
                if let Some(q) = ctx.param_str_opt(params, "query") {
                    if !q.trim().is_empty() {
                        url.push_str(&format!("&query={}", urlencoding::encode(&q)));
                    }
                }
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("issue", "update") => {
                let id = require_param(ctx, params, "issueId")?;
                let mut payload = Map::new();
                if let Some(status) = ctx.param_str_opt(params, "status") {
                    if !status.trim().is_empty() {
                        payload.insert("status".into(), json!(status));
                    }
                }
                if let Some(assignee) = ctx.param_str_opt(params, "assignedTo") {
                    if !assignee.trim().is_empty() {
                        payload.insert("assignedTo".into(), json!(assignee));
                    }
                }
                let url = format!("{base}/issues/{id}/");
                send(ctx, &token, Method::PUT, &url, Some(Value::Object(payload))).await
            }
            ("issue", "delete") => {
                let id = require_param(ctx, params, "issueId")?;
                let url = format!("{base}/issues/{id}/");
                send(ctx, &token, Method::DELETE, &url, None).await
            }

            // ───────────────────────────── Event ─────────────────────────────
            ("event", "get") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let project = require_non_empty(&project, "projectSlug")?;
                let event_id = require_param(ctx, params, "eventId")?;
                let url =
                    format!("{base}/projects/{org}/{project}/events/{event_id}/");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("event", "getAll") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let project = require_non_empty(&project, "projectSlug")?;
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as u32)
                    .unwrap_or(100);
                let url = format!(
                    "{base}/projects/{org}/{project}/events/?limit={limit}"
                );
                send(ctx, &token, Method::GET, &url, None).await
            }

            // ──────────────────────────── Project ────────────────────────────
            ("project", "getAll") => {
                let url = if org.trim().is_empty() {
                    format!("{base}/projects/")
                } else {
                    format!("{base}/organizations/{org}/projects/")
                };
                send(ctx, &token, Method::GET, &url, None).await
            }

            // ──────────────────────────── Release ────────────────────────────
            ("release", "create") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let version = require_param(ctx, params, "version")?;
                let projects = collect_string_array(ctx, params, "releaseProjects");
                let mut payload = Map::new();
                payload.insert("version".into(), json!(version));
                if !projects.is_empty() {
                    payload.insert("projects".into(), json!(projects));
                }
                let url = format!("{base}/organizations/{org}/releases/");
                send(ctx, &token, Method::POST, &url, Some(Value::Object(payload))).await
            }
            ("release", "getAll") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let url = format!("{base}/organizations/{org}/releases/");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("release", "get") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let version = require_param(ctx, params, "version")?;
                let encoded = urlencoding::encode(&version);
                let url = format!("{base}/organizations/{org}/releases/{encoded}/");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("release", "delete") => {
                let org = require_non_empty(&org, "organizationSlug")?;
                let version = require_param(ctx, params, "version")?;
                let encoded = urlencoding::encode(&version);
                let url = format!("{base}/organizations/{org}/releases/{encoded}/");
                send(ctx, &token, Method::DELETE, &url, None).await
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

fn require_non_empty(v: &str, name: &str) -> NodeResult<String> {
    let trimmed = v.trim();
    if trimmed.is_empty() {
        return Err(NodeError::MissingParameter(name.to_string()));
    }
    Ok(trimmed.to_string())
}

fn collect_string_array(ctx: &ExecutionContext, params: &Value, key: &str) -> Vec<String> {
    let Some(raw) = params.get(key) else {
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
                (!s.trim().is_empty()).then_some(s)
            }
            other => {
                let s = other.to_string();
                (!s.trim().is_empty()).then_some(s)
            }
        })
        .collect()
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
        .bearer_auth(token)
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
    let items = match parsed {
        Value::Array(a) => a,
        Value::Null => vec![],
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
