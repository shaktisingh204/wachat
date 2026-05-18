//! Bitbucket node — operations against the Bitbucket Cloud REST API v2
//! (`https://api.bitbucket.org/2.0`).
//!
//! Authentication uses either:
//!   * `accessToken`  — sent as `Authorization: Bearer <token>` (preferred for
//!     workspace access tokens and repository access tokens).
//!   * `username` + `appPassword` — Basic Auth fallback for legacy app
//!     passwords. The credential record may carry either pair.
//!
//! Supports the common workspace + repo operations:
//!   * Repository: get, getAll (by workspace)
//!   * Pull Request: create, get, getAll, merge, decline
//!   * Issue: create, get, getAll, update
//!   * User: getMe (current authenticated user)
//!   * Pipeline: trigger, get, getAll

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

pub struct BitbucketNode;

const API_BASE: &str = "https://api.bitbucket.org/2.0";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

enum Auth {
    Bearer(String),
    Basic { user: String, pass: String },
}

#[async_trait]
impl Node for BitbucketNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bitbucket",
            "Bitbucket",
            "Manage Bitbucket repositories, pull requests, issues, and pipelines",
            NodeCategory::Developer,
        )
        .icon("git-branch")
        .color("#2684FF")
        .credentials(vec![CredentialBinding {
            name: "bitbucketApi".into(),
            display_name: "Bitbucket API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Repository", "repository"),
                    opt("Pull Request", "pullRequest"),
                    opt("Issue", "issue"),
                    opt("User", "user"),
                    opt("Pipeline", "pipeline"),
                ])
                .default(json!("repository"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Merge", "merge"),
                    opt("Decline", "decline"),
                    opt("Trigger", "trigger"),
                    opt("Get Me", "getMe"),
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("workspace", "Workspace", NodePropertyType::String)
                .placeholder("my-workspace")
                .show_when(
                    "resource",
                    &["repository", "pullRequest", "issue", "pipeline"],
                ),
            NodeProperty::new("repoSlug", "Repository Slug", NodePropertyType::String)
                .placeholder("my-repo")
                .show_when("resource", &["pullRequest", "issue", "pipeline"]),
            NodeProperty::new("pullRequestId", "Pull Request ID", NodePropertyType::String)
                .show_when("resource", &["pullRequest"]),
            NodeProperty::new("issueId", "Issue ID", NodePropertyType::String)
                .show_when("resource", &["issue"]),
            NodeProperty::new("pipelineUuid", "Pipeline UUID", NodePropertyType::String)
                .show_when("resource", &["pipeline"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            // sourceBranch / destinationBranch only matter for pullRequest:create;
            // we gate on the operation rather than chaining show_when (the
            // builder only keeps the last predicate).
            NodeProperty::new("sourceBranch", "Source Branch", NodePropertyType::String)
                .placeholder("feature/foo")
                .show_when("operation", &["create"]),
            NodeProperty::new("destinationBranch", "Destination Branch", NodePropertyType::String)
                .placeholder("main")
                .show_when("operation", &["create"]),
            NodeProperty::new("mergeStrategy", "Merge Strategy", NodePropertyType::Options)
                .options(vec![
                    opt("Merge Commit", "merge_commit"),
                    opt("Squash", "squash"),
                    opt("Fast Forward", "fast_forward"),
                ])
                .default(json!("merge_commit"))
                .show_when("operation", &["merge"]),
            NodeProperty::new("triggerBranch", "Branch", NodePropertyType::String)
                .placeholder("main")
                .show_when("operation", &["trigger"]),
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
        let auth = if let Some(token) = cred.data.get("accessToken").filter(|s| !s.is_empty()) {
            Auth::Bearer(token.clone())
        } else if let (Some(u), Some(p)) = (
            cred.data.get("username").filter(|s| !s.is_empty()),
            cred.data.get("appPassword").filter(|s| !s.is_empty()),
        ) {
            Auth::Basic {
                user: u.clone(),
                pass: p.clone(),
            }
        } else {
            return Err(NodeError::MissingParameter(
                "accessToken or (username + appPassword)".into(),
            ));
        };

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "repository".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let workspace = ctx.param_str_opt(params, "workspace").unwrap_or_default();
        let repo = ctx.param_str_opt(params, "repoSlug").unwrap_or_default();

        match (resource.as_str(), operation.as_str()) {
            // ───────────────────────── Repository ────────────────────────────
            ("repository", "get") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("repository", "getAll") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let url = format!("{API_BASE}/repositories/{ws}");
                send(ctx, &auth, Method::GET, &url, None).await
            }

            // ───────────────────────── Pull Request ──────────────────────────
            ("pullRequest", "create") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let title = require_param(ctx, params, "title")?;
                let source = require_param(ctx, params, "sourceBranch")?;
                let dest = require_param(ctx, params, "destinationBranch")?;
                let mut payload = Map::new();
                payload.insert("title".into(), json!(title));
                payload.insert(
                    "source".into(),
                    json!({ "branch": { "name": source } }),
                );
                payload.insert(
                    "destination".into(),
                    json!({ "branch": { "name": dest } }),
                );
                if let Some(desc) = ctx.param_str_opt(params, "description") {
                    if !desc.trim().is_empty() {
                        payload.insert("description".into(), json!(desc));
                    }
                }
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pullrequests");
                send(ctx, &auth, Method::POST, &url, Some(Value::Object(payload))).await
            }
            ("pullRequest", "get") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let id = require_param(ctx, params, "pullRequestId")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pullrequests/{id}");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("pullRequest", "getAll") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pullrequests");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("pullRequest", "merge") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let id = require_param(ctx, params, "pullRequestId")?;
                let strategy = ctx
                    .param_str_opt(params, "mergeStrategy")
                    .unwrap_or_else(|| "merge_commit".to_string());
                let payload = json!({ "merge_strategy": strategy });
                let url =
                    format!("{API_BASE}/repositories/{ws}/{r}/pullrequests/{id}/merge");
                send(ctx, &auth, Method::POST, &url, Some(payload)).await
            }
            ("pullRequest", "decline") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let id = require_param(ctx, params, "pullRequestId")?;
                let url =
                    format!("{API_BASE}/repositories/{ws}/{r}/pullrequests/{id}/decline");
                send(ctx, &auth, Method::POST, &url, Some(json!({}))).await
            }

            // ─────────────────────────── Issue ───────────────────────────────
            ("issue", "create") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let title = require_param(ctx, params, "title")?;
                let mut payload = Map::new();
                payload.insert("title".into(), json!(title));
                if let Some(desc) = ctx.param_str_opt(params, "description") {
                    if !desc.trim().is_empty() {
                        payload.insert(
                            "content".into(),
                            json!({ "raw": desc }),
                        );
                    }
                }
                let url = format!("{API_BASE}/repositories/{ws}/{r}/issues");
                send(ctx, &auth, Method::POST, &url, Some(Value::Object(payload))).await
            }
            ("issue", "get") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let id = require_param(ctx, params, "issueId")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/issues/{id}");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("issue", "getAll") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/issues");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("issue", "update") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let id = require_param(ctx, params, "issueId")?;
                let mut payload = Map::new();
                if let Some(t) = ctx.param_str_opt(params, "title") {
                    if !t.trim().is_empty() {
                        payload.insert("title".into(), json!(t));
                    }
                }
                if let Some(desc) = ctx.param_str_opt(params, "description") {
                    if !desc.trim().is_empty() {
                        payload.insert("content".into(), json!({ "raw": desc }));
                    }
                }
                let url = format!("{API_BASE}/repositories/{ws}/{r}/issues/{id}");
                send(ctx, &auth, Method::PUT, &url, Some(Value::Object(payload))).await
            }

            // ──────────────────────────── User ───────────────────────────────
            ("user", "getMe") => {
                let url = format!("{API_BASE}/user");
                send(ctx, &auth, Method::GET, &url, None).await
            }

            // ───────────────────────── Pipeline ──────────────────────────────
            ("pipeline", "trigger") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let branch = require_param(ctx, params, "triggerBranch")?;
                let payload = json!({
                    "target": {
                        "ref_type": "branch",
                        "type": "pipeline_ref_target",
                        "ref_name": branch,
                    }
                });
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pipelines/");
                send(ctx, &auth, Method::POST, &url, Some(payload)).await
            }
            ("pipeline", "get") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let uuid = require_param(ctx, params, "pipelineUuid")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pipelines/{uuid}");
                send(ctx, &auth, Method::GET, &url, None).await
            }
            ("pipeline", "getAll") => {
                let ws = require_non_empty(&workspace, "workspace")?;
                let r = require_non_empty(&repo, "repoSlug")?;
                let url = format!("{API_BASE}/repositories/{ws}/{r}/pipelines/");
                send(ctx, &auth, Method::GET, &url, None).await
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

async fn send(
    ctx: &ExecutionContext,
    auth: &Auth,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let mut req: RequestBuilder = ctx
        .http
        .request(method, url)
        .header("Accept", "application/json");
    req = match auth {
        Auth::Bearer(t) => req.bearer_auth(t),
        Auth::Basic { user, pass } => req.basic_auth(user, Some(pass)),
    };
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
    // Bitbucket list endpoints return `{ "values": [...], "pagelen": ..., ... }`.
    // Unwrap so consumers see an item-per-result, like other nodes.
    let items = match parsed {
        Value::Array(a) => a,
        Value::Null => vec![],
        Value::Object(ref map) if map.contains_key("values") => match map.get("values").cloned() {
            Some(Value::Array(a)) => a,
            _ => vec![parsed],
        },
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
