//! Microsoft To Do node — task lists and tasks via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `microsoftOAuth2Api` credential (Bearer accessToken).
//!
//! Resources / operations implemented:
//!   - list.list     GET    `/me/todo/lists`
//!   - list.create   POST   `/me/todo/lists`
//!   - list.delete   DELETE `/me/todo/lists/{id}`
//!   - task.list     GET    `/me/todo/lists/{list-id}/tasks`
//!   - task.get      GET    `/me/todo/lists/{list-id}/tasks/{id}`
//!   - task.create   POST   `/me/todo/lists/{list-id}/tasks`
//!   - task.update   PATCH  `/me/todo/lists/{list-id}/tasks/{id}`
//!   - task.delete   DELETE `/me/todo/lists/{list-id}/tasks/{id}`

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
    nodes::microsoft_outlook::{emit, emit_or_ack, ms_bearer_token, urlencode_path},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

pub struct MicrosoftToDoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftToDoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftToDo",
            "Microsoft To Do",
            "Manage Microsoft To Do task lists and tasks",
            NodeCategory::Productivity,
        )
        .icon("check-square")
        .color("#2564CF")
        .credentials(vec![CredentialBinding {
            name: "microsoftOAuth2Api".into(),
            display_name: "Microsoft OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Task List", "list"), opt("Task", "task")])
                .default(json!("task"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("listId", "Task List ID", NodePropertyType::String)
                .show_when("resource", &["task", "list"]),
            NodeProperty::new("taskId", "Task ID", NodePropertyType::String)
                .show_when("resource", &["task"]),
            NodeProperty::new("displayName", "Display Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("resource", &["task"]),
            NodeProperty::new("body", "Body / Notes", NodePropertyType::String)
                .show_when("resource", &["task"]),
            NodeProperty::new("dueDateTime", "Due (ISO 8601)", NodePropertyType::String)
                .show_when("resource", &["task"])
                .placeholder("2026-05-20T17:00:00"),
            NodeProperty::new("status", "Status", NodePropertyType::Options)
                .options(vec![
                    opt("Not Started", "notStarted"),
                    opt("In Progress", "inProgress"),
                    opt("Completed", "completed"),
                    opt("Waiting On Others", "waitingOnOthers"),
                    opt("Deferred", "deferred"),
                ])
                .default(json!("notStarted"))
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("importance", "Importance", NodePropertyType::Options)
                .options(vec![
                    opt("Low", "low"),
                    opt("Normal", "normal"),
                    opt("High", "high"),
                ])
                .default(json!("normal"))
                .show_when("operation", &["create", "update"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let token = ms_bearer_token(ctx, params)?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            ("list", "list") => {
                let url = format!("{GRAPH_BASE}/me/todo/lists");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("list", "create") => {
                let name = ctx.param_str(params, "displayName")?;
                let url = format!("{GRAPH_BASE}/me/todo/lists");
                let payload = json!({ "displayName": name });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("list", "delete") => {
                let id = ctx.param_str(params, "listId")?;
                let url = format!("{GRAPH_BASE}/me/todo/lists/{}", urlencode_path(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": id })).await
            }
            ("task", "list") => {
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!(
                    "{GRAPH_BASE}/me/todo/lists/{}/tasks",
                    urlencode_path(&list_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("task", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                let task_id = ctx.param_str(params, "taskId")?;
                let url = format!(
                    "{GRAPH_BASE}/me/todo/lists/{}/tasks/{}",
                    urlencode_path(&list_id),
                    urlencode_path(&task_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("task", "create") => {
                let list_id = ctx.param_str(params, "listId")?;
                let title = ctx.param_str(params, "title")?;
                let body = ctx.param_str_opt(params, "body").unwrap_or_default();
                let due = ctx.param_str_opt(params, "dueDateTime").unwrap_or_default();
                let status = ctx
                    .param_str_opt(params, "status")
                    .unwrap_or_else(|| "notStarted".to_string());
                let importance = ctx
                    .param_str_opt(params, "importance")
                    .unwrap_or_else(|| "normal".to_string());

                let mut payload = json!({
                    "title": title,
                    "status": status,
                    "importance": importance,
                });
                if !body.is_empty() {
                    payload["body"] =
                        json!({ "contentType": "text", "content": body });
                }
                if !due.is_empty() {
                    payload["dueDateTime"] =
                        json!({ "dateTime": due, "timeZone": "UTC" });
                }
                let url = format!(
                    "{GRAPH_BASE}/me/todo/lists/{}/tasks",
                    urlencode_path(&list_id),
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("task", "update") => {
                let list_id = ctx.param_str(params, "listId")?;
                let task_id = ctx.param_str(params, "taskId")?;
                let mut payload = serde_json::Map::new();
                if let Some(t) = ctx.param_str_opt(params, "title").filter(|s| !s.is_empty()) {
                    payload.insert("title".into(), json!(t));
                }
                if let Some(b) = ctx.param_str_opt(params, "body").filter(|s| !s.is_empty()) {
                    payload.insert(
                        "body".into(),
                        json!({ "contentType": "text", "content": b }),
                    );
                }
                if let Some(d) = ctx
                    .param_str_opt(params, "dueDateTime")
                    .filter(|s| !s.is_empty())
                {
                    payload.insert(
                        "dueDateTime".into(),
                        json!({ "dateTime": d, "timeZone": "UTC" }),
                    );
                }
                if let Some(s) = ctx.param_str_opt(params, "status").filter(|s| !s.is_empty()) {
                    payload.insert("status".into(), json!(s));
                }
                if let Some(i) = ctx
                    .param_str_opt(params, "importance")
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("importance".into(), json!(i));
                }
                let url = format!(
                    "{GRAPH_BASE}/me/todo/lists/{}/tasks/{}",
                    urlencode_path(&list_id),
                    urlencode_path(&task_id),
                );
                let res = ctx
                    .http
                    .patch(&url)
                    .bearer_auth(&token)
                    .json(&Value::Object(payload))
                    .send()
                    .await?;
                emit(res).await
            }
            ("task", "delete") => {
                let list_id = ctx.param_str(params, "listId")?;
                let task_id = ctx.param_str(params, "taskId")?;
                let url = format!(
                    "{GRAPH_BASE}/me/todo/lists/{}/tasks/{}",
                    urlencode_path(&list_id),
                    urlencode_path(&task_id),
                );
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": task_id })).await
            }
            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported resource/operation combination: {r}/{o}"),
            }),
        }
    }
}
