//! Jira Cloud node — issue, project, and user operations against the Jira
//! Cloud REST API v3 (`{baseUrl}/rest/api/3`).
//!
//! Authentication is HTTP Basic with `email:apiToken` taken from a `jiraApi`
//! credential whose `data` map carries `baseUrl`, `email`, and `apiToken`.

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

pub struct JiraNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for JiraNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jira",
            "Jira",
            "Jira issue tracking",
            NodeCategory::Developer,
        )
        .icon("layers")
        .color("#0052CC")
        .credentials(vec![CredentialBinding {
            name: "jiraApi".into(),
            display_name: "Jira API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Issue", "issue"),
                    opt("Project", "project"),
                    opt("User", "user"),
                ])
                .default(json!("issue"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Add Comment", "addComment"),
                    opt("Transition", "transition"),
                    opt("Search", "search"),
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .required(),
            // Issue identifiers / payload
            NodeProperty::new("issueIdOrKey", "Issue ID or Key", NodePropertyType::String)
                .placeholder("PROJ-123")
                .show_when(
                    "operation",
                    &["get", "update", "delete", "addComment", "transition"],
                ),
            NodeProperty::new("projectKey", "Project Key", NodePropertyType::String)
                .placeholder("PROJ")
                .show_when("operation", &["create"]),
            NodeProperty::new("summary", "Summary", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("issueType", "Issue Type", NodePropertyType::String)
                .placeholder("Task")
                .default(json!("Task"))
                .show_when("operation", &["create"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("comment", "Comment", NodePropertyType::String)
                .show_when("operation", &["addComment"]),
            NodeProperty::new("transitionId", "Transition ID", NodePropertyType::String)
                .show_when("operation", &["transition"]),
            NodeProperty::new("jql", "JQL", NodePropertyType::String)
                .placeholder("project = PROJ AND status = \"In Progress\"")
                .show_when("operation", &["search"]),
            // Project / user identifiers
            NodeProperty::new(
                "projectIdOrKey",
                "Project ID or Key",
                NodePropertyType::String,
            )
            .show_when("resource", &["project"]),
            NodeProperty::new("query", "User Query", NodePropertyType::String)
                .placeholder("alice@example.com")
                .show_when("resource", &["user"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // ── credential ─────────────────────────────────────────────────────
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let email = cred
            .data
            .get("email")
            .ok_or_else(|| NodeError::MissingParameter("email".into()))?
            .clone();
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "issue".to_string());
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ───────────────────────────── Issue ─────────────────────────────
            ("issue", "create") => {
                let project_key = sub_required(ctx, params, "projectKey")?;
                let summary = sub_required(ctx, params, "summary")?;
                let issue_type = ctx
                    .param_str_opt(params, "issueType")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "Task".to_string());
                let description = ctx
                    .param_str_opt(params, "description")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();

                let mut fields = Map::new();
                fields.insert("project".into(), json!({ "key": project_key }));
                fields.insert("summary".into(), json!(summary));
                fields.insert("issuetype".into(), json!({ "name": issue_type }));
                if !description.is_empty() {
                    fields.insert("description".into(), adf_paragraph(&description));
                }

                let body = json!({ "fields": Value::Object(fields) });
                let url = format!("{base_url}/rest/api/3/issue");
                send_json(ctx, &email, &api_token, Method::POST, &url, Some(body)).await
            }
            ("issue", "get") => {
                let id = sub_required(ctx, params, "issueIdOrKey")?;
                let url = format!("{base_url}/rest/api/3/issue/{id}");
                send_json(ctx, &email, &api_token, Method::GET, &url, None).await
            }
            ("issue", "update") => {
                let id = sub_required(ctx, params, "issueIdOrKey")?;
                let mut fields = Map::new();
                if let Some(s) = ctx.param_str_opt(params, "summary") {
                    let s = ctx.substitute(&s);
                    if !s.is_empty() {
                        fields.insert("summary".into(), json!(s));
                    }
                }
                if let Some(d) = ctx.param_str_opt(params, "description") {
                    let d = ctx.substitute(&d);
                    if !d.is_empty() {
                        fields.insert("description".into(), adf_paragraph(&d));
                    }
                }
                let body = json!({ "fields": Value::Object(fields) });
                let url = format!("{base_url}/rest/api/3/issue/{id}");
                send_json(ctx, &email, &api_token, Method::PUT, &url, Some(body)).await
            }
            ("issue", "delete") => {
                let id = sub_required(ctx, params, "issueIdOrKey")?;
                let url = format!("{base_url}/rest/api/3/issue/{id}");
                send_json(ctx, &email, &api_token, Method::DELETE, &url, None).await
            }
            ("issue", "addComment") => {
                let id = sub_required(ctx, params, "issueIdOrKey")?;
                let comment = sub_required(ctx, params, "comment")?;
                let body = json!({ "body": adf_paragraph(&comment) });
                let url = format!("{base_url}/rest/api/3/issue/{id}/comment");
                send_json(ctx, &email, &api_token, Method::POST, &url, Some(body)).await
            }
            ("issue", "transition") => {
                let id = sub_required(ctx, params, "issueIdOrKey")?;
                let transition_id = sub_required(ctx, params, "transitionId")?;
                let body = json!({ "transition": { "id": transition_id } });
                let url = format!("{base_url}/rest/api/3/issue/{id}/transitions");
                send_json(ctx, &email, &api_token, Method::POST, &url, Some(body)).await
            }
            ("issue", "search") => {
                let jql = sub_required(ctx, params, "jql")?;
                let encoded = url_encode(&jql);
                let url = format!("{base_url}/rest/api/3/search?jql={encoded}");
                send_json(ctx, &email, &api_token, Method::GET, &url, None).await
            }

            // ──────────────────────────── Project ────────────────────────────
            ("project", "list") => {
                let url = format!("{base_url}/rest/api/3/project");
                send_json(ctx, &email, &api_token, Method::GET, &url, None).await
            }
            ("project", "get") => {
                let id = sub_required(ctx, params, "projectIdOrKey")?;
                let url = format!("{base_url}/rest/api/3/project/{id}");
                send_json(ctx, &email, &api_token, Method::GET, &url, None).await
            }

            // ────────────────────────────── User ─────────────────────────────
            ("user", "search") => {
                let q = sub_required(ctx, params, "query")?;
                let encoded = url_encode(&q);
                let url = format!("{base_url}/rest/api/3/user/search?query={encoded}");
                send_json(ctx, &email, &api_token, Method::GET, &url, None).await
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

/// Wrap a plain string as an Atlassian Document Format paragraph — required
/// by Jira Cloud REST v3 for `description` and `comment.body` fields.
fn adf_paragraph(text: &str) -> Value {
    json!({
        "type": "doc",
        "version": 1,
        "content": [{
            "type": "paragraph",
            "content": [{ "type": "text", "text": text }],
        }],
    })
}

/// Minimal RFC 3986 percent-encoding for query-string values.
fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            other => {
                out.push('%');
                out.push_str(&format!("{other:02X}"));
            }
        }
    }
    out
}

/// Build the Jira request with Basic auth, run it, parse JSON, propagate
/// non-2xx responses as `NodeError::UpstreamError`.
async fn send_json(
    ctx: &ExecutionContext,
    email: &str,
    api_token: &str,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let mut req: RequestBuilder = ctx
        .http
        .request(method, url)
        .basic_auth(email, Some(api_token))
        .header("Accept", "application/json");
    if let Some(b) = body {
        req = req.header("Content-Type", "application/json").json(&b);
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
