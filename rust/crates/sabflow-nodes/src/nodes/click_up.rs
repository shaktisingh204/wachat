//! ClickUp node — tasks, lists, folders, spaces, teams via the ClickUp REST API.
//!
//! API base: https://api.clickup.com/api/v2
//! Auth: `Authorization: <personalToken>` (no Bearer prefix)

use async_trait::async_trait;
use reqwest::RequestBuilder;
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

const CLICKUP_BASE: &str = "https://api.clickup.com/api/v2";

pub struct ClickUpNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ClickUpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "clickUp",
            "ClickUp",
            "ClickUp project management",
            NodeCategory::Productivity,
        )
        .icon("check-square")
        .color("#7B68EE")
        .credentials(vec![CredentialBinding {
            name: "clickUpApi".into(),
            display_name: "ClickUp API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Task", "task"),
                    opt("List", "list"),
                    opt("Folder", "folder"),
                    opt("Space", "space"),
                    opt("Team", "team"),
                ])
                .default(json!("task"))
                .required(),
            // ── task operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Get Many", "getMany"),
                ])
                .default(json!("create"))
                .show_when("resource", &["task"])
                .required(),
            // ── list operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get Many", "getMany"),
                ])
                .default(json!("getMany"))
                .show_when("resource", &["list"])
                .required(),
            // ── folder operations ──────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Get Many", "getMany"),
                ])
                .default(json!("getMany"))
                .show_when("resource", &["folder"])
                .required(),
            // ── space operations ───────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get"), opt("Get Many", "getMany")])
                .default(json!("getMany"))
                .show_when("resource", &["space"])
                .required(),
            // ── team operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get Many", "getMany")])
                .default(json!("getMany"))
                .show_when("resource", &["team"])
                .required(),
            // ── identifiers ────────────────────────────────────────────────────
            NodeProperty::new("taskId", "Task ID", NodePropertyType::String)
                .show_when("resource", &["task"]),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .show_when("resource", &["task", "list"]),
            NodeProperty::new("folderId", "Folder ID", NodePropertyType::String)
                .show_when("resource", &["folder", "list"]),
            NodeProperty::new("spaceId", "Space ID", NodePropertyType::String)
                .show_when("resource", &["space", "folder"]),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                .show_when("resource", &["team", "space"]),
            // ── task fields ────────────────────────────────────────────────────
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .description("Task / list / folder / space name")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("status", "Status", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("priority", "Priority", NodePropertyType::Number)
                .description("1 (Urgent) – 4 (Low)")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("dueDate", "Due Date (ms)", NodePropertyType::Number)
                .description("Unix epoch milliseconds")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("assignees", "Assignees", NodePropertyType::Json)
                .default(json!([]))
                .description("Array of user IDs")
                .show_when("operation", &["create", "update"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "task".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body = match (resource.as_str(), operation.as_str()) {
            // ─── Task ────────────────────────────────────────────────────────
            ("task", "create") => {
                let list_id = ctx.param_str(params, "listId")?;
                let payload = build_task_payload(ctx, params);
                let url = format!("{CLICKUP_BASE}/list/{list_id}/task");
                send_json(clickup_req(ctx, &token, reqwest::Method::POST, &url), &payload)
                    .await?
            }
            ("task", "get") => {
                let task_id = ctx.param_str(params, "taskId")?;
                let url = format!("{CLICKUP_BASE}/task/{task_id}");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("task", "update") => {
                let task_id = ctx.param_str(params, "taskId")?;
                let payload = build_task_payload(ctx, params);
                let url = format!("{CLICKUP_BASE}/task/{task_id}");
                send_json(clickup_req(ctx, &token, reqwest::Method::PUT, &url), &payload)
                    .await?
            }
            ("task", "delete") => {
                let task_id = ctx.param_str(params, "taskId")?;
                let url = format!("{CLICKUP_BASE}/task/{task_id}");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::DELETE, &url)).await?
            }
            ("task", "getMany") => {
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!("{CLICKUP_BASE}/list/{list_id}/task");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            // ─── List ────────────────────────────────────────────────────────
            ("list", "create") => {
                let folder_id = ctx.param_str(params, "folderId")?;
                let name = ctx
                    .param_str_opt(params, "name")
                    .unwrap_or_default();
                let url = format!("{CLICKUP_BASE}/folder/{folder_id}/list");
                send_json(
                    clickup_req(ctx, &token, reqwest::Method::POST, &url),
                    &json!({ "name": name }),
                )
                .await?
            }
            ("list", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!("{CLICKUP_BASE}/list/{list_id}");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("list", "getMany") => {
                let folder_id = ctx.param_str(params, "folderId")?;
                let url = format!("{CLICKUP_BASE}/folder/{folder_id}/list");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            // ─── Folder ──────────────────────────────────────────────────────
            ("folder", "create") => {
                let space_id = ctx.param_str(params, "spaceId")?;
                let name = ctx
                    .param_str_opt(params, "name")
                    .unwrap_or_default();
                let url = format!("{CLICKUP_BASE}/space/{space_id}/folder");
                send_json(
                    clickup_req(ctx, &token, reqwest::Method::POST, &url),
                    &json!({ "name": name }),
                )
                .await?
            }
            ("folder", "get") => {
                let folder_id = ctx.param_str(params, "folderId")?;
                let url = format!("{CLICKUP_BASE}/folder/{folder_id}");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("folder", "getMany") => {
                let space_id = ctx.param_str(params, "spaceId")?;
                let url = format!("{CLICKUP_BASE}/space/{space_id}/folder");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            // ─── Space ───────────────────────────────────────────────────────
            ("space", "get") => {
                let space_id = ctx.param_str(params, "spaceId")?;
                let url = format!("{CLICKUP_BASE}/space/{space_id}");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("space", "getMany") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let url = format!("{CLICKUP_BASE}/team/{team_id}/space");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            // ─── Team ────────────────────────────────────────────────────────
            ("team", "getMany") => {
                let url = format!("{CLICKUP_BASE}/team");
                send_no_body(clickup_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported {res}:{op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

fn clickup_req(
    ctx: &ExecutionContext,
    token: &str,
    method: reqwest::Method,
    url: &str,
) -> RequestBuilder {
    // ClickUp uses the bare token (no "Bearer " prefix) in Authorization.
    ctx.http
        .request(method, url)
        .header("Authorization", token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
}

async fn send_json(req: RequestBuilder, payload: &Value) -> NodeResult<Value> {
    let res = req.json(payload).send().await?;
    decode(res).await
}

async fn send_no_body(req: RequestBuilder) -> NodeResult<Value> {
    let res = req.send().await?;
    decode(res).await
}

async fn decode(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body: Value = serde_json::from_slice(&bytes).unwrap_or_else(|_| {
        Value::String(String::from_utf8_lossy(&bytes).into_owned())
    });
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: match &body {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            },
        });
    }
    Ok(body)
}

/// Build the JSON payload for task create/update from user-provided params.
/// Only includes keys the user actually supplied.
fn build_task_payload(ctx: &ExecutionContext, params: &Value) -> Value {
    let mut out: Map<String, Value> = Map::new();

    if let Some(name) = ctx.param_str_opt(params, "name") {
        if !name.is_empty() {
            out.insert("name".into(), Value::String(name));
        }
    }
    if let Some(desc) = ctx.param_str_opt(params, "description") {
        if !desc.is_empty() {
            out.insert("description".into(), Value::String(desc));
        }
    }
    if let Some(status) = ctx.param_str_opt(params, "status") {
        if !status.is_empty() {
            out.insert("status".into(), Value::String(status));
        }
    }
    if let Some(p) = ctx.param_f64(params, "priority") {
        // ClickUp expects an integer 1..=4.
        out.insert("priority".into(), json!(p as i64));
    }
    if let Some(due) = ctx.param_f64(params, "dueDate") {
        out.insert("due_date".into(), json!(due as i64));
    }
    if let Some(assignees) = resolve_json(ctx, params.get("assignees")) {
        out.insert("assignees".into(), assignees);
    }

    Value::Object(out)
}

/// Recursively substitute `{{var}}` placeholders inside string leaves.
fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(
            arr.into_iter().map(|x| substitute_value(ctx, x)).collect(),
        ),
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

/// Accept a JSON-shaped param that may arrive either as a real JSON value or a
/// JSON-encoded string. Returns None for empty/blank input.
fn resolve_json(ctx: &ExecutionContext, raw: Option<&Value>) -> Option<Value> {
    let v = raw?.clone();
    let resolved = match v {
        Value::String(s) => {
            let s = ctx.substitute(&s);
            if s.trim().is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(&s).unwrap_or(Value::String(s))
        }
        other => substitute_value(ctx, other),
    };
    if is_empty_value(&resolved) {
        return None;
    }
    Some(resolved)
}

fn is_empty_value(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::Object(m) => m.is_empty(),
        Value::Array(a) => a.is_empty(),
        Value::String(s) => s.trim().is_empty(),
        _ => false,
    }
}
