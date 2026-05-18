//! Todoist node — Todoist REST API v2 (`https://api.todoist.com/rest/v2`).
//!
//! Auth: a personal API token from the Todoist settings page, sent as
//! `Authorization: Bearer <token>`.  The linked credential's
//! `data["apiToken"]` holds the secret.
//!
//! Supported operations:
//!   - `task.list`, `task.get`, `task.create`, `task.update`,
//!     `task.close`, `task.reopen`, `task.delete`
//!   - `project.list`, `project.get`, `project.create`, `project.delete`
//!   - `label.list`

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

const TODOIST_BASE: &str = "https://api.todoist.com/rest/v2";

pub struct TodoistNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TodoistNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "todoist",
            "Todoist",
            "Todoist task and project manager",
            NodeCategory::Productivity,
        )
        .icon("check-square")
        .color("#E44332")
        .credentials(vec![CredentialBinding {
            name: "todoistApi".into(),
            display_name: "Todoist API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Tasks", "task.list"),
                    opt("Get Task", "task.get"),
                    opt("Create Task", "task.create"),
                    opt("Update Task", "task.update"),
                    opt("Close Task", "task.close"),
                    opt("Reopen Task", "task.reopen"),
                    opt("Delete Task", "task.delete"),
                    opt("List Projects", "project.list"),
                    opt("Get Project", "project.get"),
                    opt("Create Project", "project.create"),
                    opt("Delete Project", "project.delete"),
                    opt("List Labels", "label.list"),
                ])
                .default(json!("task.list"))
                .required(),
            NodeProperty::new("taskId", "Task ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &[
                        "task.get",
                        "task.update",
                        "task.close",
                        "task.reopen",
                        "task.delete",
                    ],
                ),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["task.list", "project.get", "project.delete"],
                ),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .placeholder("Buy milk")
                .show_when("operation", &["task.create", "task.update"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["task.create", "task.update"]),
            NodeProperty::new("dueString", "Due (natural language)", NodePropertyType::String)
                .placeholder("tomorrow at 10am")
                .show_when("operation", &["task.create", "task.update"]),
            NodeProperty::new("priority", "Priority (1-4)", NodePropertyType::Number)
                .show_when("operation", &["task.create", "task.update"]),
            NodeProperty::new("labels", "Labels", NodePropertyType::String)
                .show_when("operation", &["task.create", "task.update"])
                .description("Comma-separated label names"),
            NodeProperty::new("projectName", "Project Name", NodePropertyType::String)
                .show_when("operation", &["project.create"]),
            NodeProperty::new("filter", "Filter", NodePropertyType::String)
                .show_when("operation", &["task.list"])
                .description("Todoist filter expression e.g. `today | overdue`"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let token = ctx
            .credential(&cred_id)?
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            // ----- TASKS -----
            "task.list" => {
                let url = format!("{TODOIST_BASE}/tasks");
                let mut q: Vec<(String, String)> = Vec::new();
                if let Some(p) = sub_opt(ctx, params, "projectId") {
                    if !p.is_empty() {
                        q.push(("project_id".into(), p));
                    }
                }
                if let Some(f) = sub_opt(ctx, params, "filter") {
                    if !f.is_empty() {
                        q.push(("filter".into(), f));
                    }
                }
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&q)
                    .send()
                    .await?;
                wrap(res).await
            }
            "task.get" => {
                let id = sub(ctx, params, "taskId")?;
                let url = format!("{TODOIST_BASE}/tasks/{}", urlencoding::encode(&id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "task.create" => {
                let content = sub(ctx, params, "content")?;
                let mut body = Map::new();
                body.insert("content".into(), json!(content));
                if let Some(d) = sub_opt(ctx, params, "description") {
                    if !d.is_empty() {
                        body.insert("description".into(), json!(d));
                    }
                }
                if let Some(p) = sub_opt(ctx, params, "projectId") {
                    if !p.is_empty() {
                        body.insert("project_id".into(), json!(p));
                    }
                }
                if let Some(d) = sub_opt(ctx, params, "dueString") {
                    if !d.is_empty() {
                        body.insert("due_string".into(), json!(d));
                    }
                }
                if let Some(p) = ctx.param_f64(params, "priority") {
                    body.insert("priority".into(), json!(p as i64));
                }
                if let Some(l) = sub_opt(ctx, params, "labels") {
                    let list: Vec<Value> = l
                        .split(',')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect();
                    if !list.is_empty() {
                        body.insert("labels".into(), Value::Array(list));
                    }
                }
                let url = format!("{TODOIST_BASE}/tasks");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            "task.update" => {
                let id = sub(ctx, params, "taskId")?;
                let mut body = Map::new();
                if let Some(c) = sub_opt(ctx, params, "content") {
                    if !c.is_empty() {
                        body.insert("content".into(), json!(c));
                    }
                }
                if let Some(d) = sub_opt(ctx, params, "description") {
                    if !d.is_empty() {
                        body.insert("description".into(), json!(d));
                    }
                }
                if let Some(d) = sub_opt(ctx, params, "dueString") {
                    if !d.is_empty() {
                        body.insert("due_string".into(), json!(d));
                    }
                }
                if let Some(p) = ctx.param_f64(params, "priority") {
                    body.insert("priority".into(), json!(p as i64));
                }
                if let Some(l) = sub_opt(ctx, params, "labels") {
                    let list: Vec<Value> = l
                        .split(',')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect();
                    if !list.is_empty() {
                        body.insert("labels".into(), Value::Array(list));
                    }
                }
                let url = format!("{TODOIST_BASE}/tasks/{}", urlencoding::encode(&id));
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            "task.close" => {
                let id = sub(ctx, params, "taskId")?;
                let url = format!("{TODOIST_BASE}/tasks/{}/close", urlencoding::encode(&id));
                let res = ctx.http.post(&url).bearer_auth(&token).send().await?;
                wrap_empty_ok(res).await
            }
            "task.reopen" => {
                let id = sub(ctx, params, "taskId")?;
                let url = format!("{TODOIST_BASE}/tasks/{}/reopen", urlencoding::encode(&id));
                let res = ctx.http.post(&url).bearer_auth(&token).send().await?;
                wrap_empty_ok(res).await
            }
            "task.delete" => {
                let id = sub(ctx, params, "taskId")?;
                let url = format!("{TODOIST_BASE}/tasks/{}", urlencoding::encode(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                wrap_empty_ok(res).await
            }

            // ----- PROJECTS -----
            "project.list" => {
                let url = format!("{TODOIST_BASE}/projects");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "project.get" => {
                let id = sub(ctx, params, "projectId")?;
                let url = format!("{TODOIST_BASE}/projects/{}", urlencoding::encode(&id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "project.create" => {
                let name = sub(ctx, params, "projectName")?;
                let url = format!("{TODOIST_BASE}/projects");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "name": name }))
                    .send()
                    .await?;
                wrap(res).await
            }
            "project.delete" => {
                let id = sub(ctx, params, "projectId")?;
                let url = format!("{TODOIST_BASE}/projects/{}", urlencoding::encode(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                wrap_empty_ok(res).await
            }

            // ----- LABELS -----
            "label.list" => {
                let url = format!("{TODOIST_BASE}/labels");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }

            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

fn sub_opt(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<String> {
    ctx.param_str_opt(params, key).map(|s| ctx.substitute(&s))
}

async fn wrap(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let value: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text))
    };
    Ok(NodeOutput::single(vec![value]))
}

async fn wrap_empty_ok(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(NodeOutput::single(vec![json!({
        "ok": true,
        "status": status.as_u16(),
    })]))
}
