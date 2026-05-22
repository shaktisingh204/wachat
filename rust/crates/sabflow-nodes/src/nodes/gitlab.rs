//! GitLab node — projects, issues, merge requests, releases.
//!
//! Implements the GitLab REST API v4 against either gitlab.com or a self-hosted
//! instance (configurable via the credential's optional `baseUrl` field).
//! Authentication uses a personal/project access token sent as the
//! `PRIVATE-TOKEN` header.

use async_trait::async_trait;
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

pub struct GitlabNode;

/// Percent-encode a path segment per RFC 3986 (unreserved chars stay as-is,
/// everything else — including `/` — becomes `%XX`).  Used because a GitLab
/// `projectId` may be either a numeric id or a `namespace/path` string that
/// must be encoded as a single segment.
fn percent_encode_segment(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.as_bytes() {
        let c = *b;
        let unreserved =
            c.is_ascii_alphanumeric() || c == b'-' || c == b'.' || c == b'_' || c == b'~';
        if unreserved {
            out.push(c as char);
        } else {
            out.push('%');
            out.push_str(&format!("{:02X}", c));
        }
    }
    out
}

fn opt(name: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(name),
        description: None,
    }
}

fn opt_kv(label: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: label.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GitlabNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gitlab",
            "GitLab",
            "GitLab repository operations",
            NodeCategory::Developer,
        )
        .icon("gitlab")
        .color("#FC6D26")
        .credentials(vec![CredentialBinding {
            name: "gitlabApi".into(),
            display_name: "GitLab API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt_kv("Issue", "issue"),
                    opt_kv("Merge Request", "mergeRequest"),
                    opt_kv("Project", "project"),
                    opt_kv("Release", "release"),
                ])
                .default(json!("issue"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt_kv("Create", "create"),
                    opt_kv("Get", "get"),
                    opt_kv("Get All", "getAll"),
                    opt_kv("Edit", "edit"),
                    opt_kv("Close", "close"),
                    opt_kv("Merge", "merge"),
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("namespace/project or 12345")
                .description("URL-encoded namespace/path or numeric project ID")
                .required(),
            NodeProperty::new("issueIid", "Issue IID", NodePropertyType::Number)
                .show_when("operation", &["get", "edit", "close"]),
            NodeProperty::new(
                "mergeRequestIid",
                "Merge Request IID",
                NodePropertyType::Number,
            )
            .show_when("operation", &["get", "merge"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["create", "edit"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create", "edit"]),
            NodeProperty::new("sourceBranch", "Source Branch", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("targetBranch", "Target Branch", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("state", "State", NodePropertyType::Options)
                .options(vec![opt("opened"), opt("closed"), opt("all")])
                .default(json!("opened"))
                .show_when("operation", &["getAll"]),
            NodeProperty::new("tagName", "Tag Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("releaseName", "Release Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // ---- credentials ----------------------------------------------------
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();
        let base_url = cred
            .data
            .get("baseUrl")
            .map(|s| s.trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "https://gitlab.com".to_string());
        let api_base = format!("{}/api/v4", base_url);

        // ---- params ---------------------------------------------------------
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;
        let project_id_raw = ctx.param_str(params, "projectId")?;
        let project_id = percent_encode_segment(&project_id_raw);

        // ---- dispatch -------------------------------------------------------
        let result = match (resource.as_str(), operation.as_str()) {
            // -------------------------------- issues -------------------------
            ("issue", "create") => {
                let title = ctx.param_str(params, "title")?;
                let description = ctx.param_str_opt(params, "description").unwrap_or_default();
                let url = format!("{}/projects/{}/issues", api_base, project_id);
                let body = json!({ "title": title, "description": description });
                gitlab_request(ctx, "POST", &url, &token, Some(&body)).await?
            }
            ("issue", "get") => {
                let iid = require_iid(params, "issueIid")?;
                let url = format!("{}/projects/{}/issues/{}", api_base, project_id, iid);
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("issue", "getAll") => {
                let state = ctx
                    .param_str_opt(params, "state")
                    .unwrap_or_else(|| "opened".to_string());
                let url = format!(
                    "{}/projects/{}/issues?state={}",
                    api_base,
                    project_id,
                    percent_encode_segment(&state)
                );
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("issue", "edit") => {
                let iid = require_iid(params, "issueIid")?;
                let mut body = serde_json::Map::new();
                if let Some(t) = ctx.param_str_opt(params, "title") {
                    if !t.is_empty() {
                        body.insert("title".into(), json!(t));
                    }
                }
                if let Some(d) = ctx.param_str_opt(params, "description") {
                    if !d.is_empty() {
                        body.insert("description".into(), json!(d));
                    }
                }
                let url = format!("{}/projects/{}/issues/{}", api_base, project_id, iid);
                gitlab_request(ctx, "PUT", &url, &token, Some(&Value::Object(body))).await?
            }
            ("issue", "close") => {
                let iid = require_iid(params, "issueIid")?;
                let url = format!("{}/projects/{}/issues/{}", api_base, project_id, iid);
                let body = json!({ "state_event": "close" });
                gitlab_request(ctx, "PUT", &url, &token, Some(&body)).await?
            }

            // ------------------------------- merge requests ------------------
            ("mergeRequest", "create") => {
                let title = ctx.param_str(params, "title")?;
                let description = ctx.param_str_opt(params, "description").unwrap_or_default();
                let source_branch = ctx.param_str(params, "sourceBranch")?;
                let target_branch = ctx.param_str(params, "targetBranch")?;
                let url = format!("{}/projects/{}/merge_requests", api_base, project_id);
                let body = json!({
                    "title": title,
                    "description": description,
                    "source_branch": source_branch,
                    "target_branch": target_branch,
                });
                gitlab_request(ctx, "POST", &url, &token, Some(&body)).await?
            }
            ("mergeRequest", "get") => {
                let iid = require_iid(params, "mergeRequestIid")?;
                let url = format!(
                    "{}/projects/{}/merge_requests/{}",
                    api_base, project_id, iid
                );
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("mergeRequest", "getAll") => {
                let url = format!("{}/projects/{}/merge_requests", api_base, project_id);
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("mergeRequest", "merge") => {
                let iid = require_iid(params, "mergeRequestIid")?;
                let url = format!(
                    "{}/projects/{}/merge_requests/{}/merge",
                    api_base, project_id, iid
                );
                gitlab_request(ctx, "PUT", &url, &token, None).await?
            }
            ("mergeRequest", "close") => {
                let iid = require_iid(params, "mergeRequestIid")?;
                let url = format!(
                    "{}/projects/{}/merge_requests/{}",
                    api_base, project_id, iid
                );
                let body = json!({ "state_event": "close" });
                gitlab_request(ctx, "PUT", &url, &token, Some(&body)).await?
            }

            // ----------------------------------- projects --------------------
            ("project", "get") => {
                let url = format!("{}/projects/{}", api_base, project_id);
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("project", "getAll") => {
                let url = format!("{}/projects?membership=true", api_base);
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }

            // ----------------------------------- releases --------------------
            ("release", "create") => {
                let tag_name = ctx.param_str(params, "tagName")?;
                let release_name = ctx
                    .param_str_opt(params, "releaseName")
                    .unwrap_or_else(|| tag_name.clone());
                let description = ctx.param_str_opt(params, "description").unwrap_or_default();
                let url = format!("{}/projects/{}/releases", api_base, project_id);
                let body = json!({
                    "tag_name": tag_name,
                    "name": release_name,
                    "description": description,
                });
                gitlab_request(ctx, "POST", &url, &token, Some(&body)).await?
            }
            ("release", "get") => {
                let tag_name = ctx.param_str(params, "tagName")?;
                let url = format!(
                    "{}/projects/{}/releases/{}",
                    api_base,
                    project_id,
                    percent_encode_segment(&tag_name)
                );
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }
            ("release", "getAll") => {
                let url = format!("{}/projects/{}/releases", api_base, project_id);
                gitlab_request(ctx, "GET", &url, &token, None).await?
            }

            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported resource/operation: {res}/{op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![result]))
    }
}

/// Extract a required numeric IID from params (accepts number or numeric string).
fn require_iid(params: &Value, key: &str) -> NodeResult<i64> {
    if let Some(n) = params.get(key).and_then(|v| v.as_i64()) {
        return Ok(n);
    }
    if let Some(s) = params.get(key).and_then(|v| v.as_str()) {
        if let Ok(n) = s.trim().parse::<i64>() {
            return Ok(n);
        }
    }
    Err(NodeError::MissingParameter(key.to_string()))
}

/// Execute a GitLab API call and parse JSON.  Non-2xx responses are mapped to
/// `NodeError::UpstreamError` carrying the raw body.
async fn gitlab_request(
    ctx: &ExecutionContext,
    method: &str,
    url: &str,
    token: &str,
    body: Option<&Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        "GET" => ctx.http.get(url),
        "POST" => ctx.http.post(url),
        "PUT" => ctx.http.put(url),
        "DELETE" => ctx.http.delete(url),
        other => {
            return Err(NodeError::InvalidParameter {
                name: "method".into(),
                reason: format!("unsupported HTTP method: {other}"),
            });
        }
    };
    req = req
        .header("PRIVATE-TOKEN", token)
        .header("Accept", "application/json");
    if let Some(b) = body {
        req = req.json(b);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    if text.is_empty() {
        return Ok(Value::Null);
    }
    let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
    Ok(parsed)
}
