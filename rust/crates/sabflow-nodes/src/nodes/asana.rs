//! Asana node.
//!
//! Implements task, project, workspace, and user operations against the
//! Asana REST API (`https://app.asana.com/api/1.0`).
//!
//! Auth: Personal Access Token. The token is read from the linked credential
//! under `data["accessToken"]` and sent as `Authorization: Bearer <token>`.

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

const ASANA_BASE: &str = "https://app.asana.com/api/1.0";

pub struct AsanaNode;

#[async_trait]
impl Node for AsanaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "asana",
            "Asana",
            "Asana project and task management",
            NodeCategory::Productivity,
        )
        .icon("check-square")
        .color("#F06A6A")
        .credentials(vec![CredentialBinding {
            name: "asanaApi".into(),
            display_name: "Asana Personal Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Task".into(),
                        value: json!("task"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Project".into(),
                        value: json!("project"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Workspace".into(),
                        value: json!("workspace"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "User".into(),
                        value: json!("user"),
                        description: None,
                    },
                ])
                .default(json!("task"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Create".into(),
                        value: json!("create"),
                        description: Some("Create a resource".into()),
                    },
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Fetch a single resource by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Update an existing resource".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a resource by ID".into()),
                    },
                    NodePropertyOption {
                        name: "List".into(),
                        value: json!("list"),
                        description: Some("List resources".into()),
                    },
                    NodePropertyOption {
                        name: "Me".into(),
                        value: json!("me"),
                        description: Some("Get the authenticated user".into()),
                    },
                ])
                .default(json!("create"))
                .required(),
            // Task-specific
            NodeProperty::new("taskId", "Task ID", NodePropertyType::String)
                .placeholder("1200000000000000")
                .show_when("operation", &["get", "update", "delete"])
                .description("Asana task GID"),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Name of the task or project"),
            NodeProperty::new("notes", "Notes", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Notes / description body"),
            NodeProperty::new("assignee", "Assignee", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Assignee user GID or email"),
            NodeProperty::new("projects", "Projects", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Comma-separated list of project GIDs"),
            // Project / workspace shared
            NodeProperty::new("workspaceId", "Workspace ID", NodePropertyType::String)
                .placeholder("1200000000000000")
                .show_when("operation", &["create", "list", "get"])
                .description("Workspace GID"),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                .placeholder("1200000000000000")
                .show_when("operation", &["create"])
                .description("Team GID (required for project creation)"),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("1200000000000000")
                .show_when("operation", &["get", "update", "delete", "list"])
                .description("Project GID — used to filter tasks list or operate on a project"),
            // User-specific
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .placeholder("1200000000000000 or me")
                .show_when("operation", &["get"])
                .description("User GID"),
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

        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ----- TASK -----
            ("task", "create") => {
                let workspace = sub(ctx, params, "workspaceId")?;
                let name = sub(ctx, params, "name")?;
                let mut data = Map::new();
                data.insert("workspace".into(), Value::String(workspace));
                data.insert("name".into(), Value::String(name));
                if let Some(notes) = sub_opt(ctx, params, "notes") {
                    if !notes.is_empty() {
                        data.insert("notes".into(), Value::String(notes));
                    }
                }
                if let Some(assignee) = sub_opt(ctx, params, "assignee") {
                    if !assignee.is_empty() {
                        data.insert("assignee".into(), Value::String(assignee));
                    }
                }
                if let Some(projects) = sub_opt(ctx, params, "projects") {
                    let list: Vec<Value> = projects
                        .split(',')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect();
                    if !list.is_empty() {
                        data.insert("projects".into(), Value::Array(list));
                    }
                }
                let url = format!("{ASANA_BASE}/tasks");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "data": Value::Object(data) }))
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("task", "get") => {
                let task_id = sub(ctx, params, "taskId")?;
                let url = format!("{ASANA_BASE}/tasks/{}", encode_path(&task_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("task", "update") => {
                let task_id = sub(ctx, params, "taskId")?;
                let mut data = Map::new();
                if let Some(name) = sub_opt(ctx, params, "name") {
                    if !name.is_empty() {
                        data.insert("name".into(), Value::String(name));
                    }
                }
                if let Some(notes) = sub_opt(ctx, params, "notes") {
                    if !notes.is_empty() {
                        data.insert("notes".into(), Value::String(notes));
                    }
                }
                if let Some(assignee) = sub_opt(ctx, params, "assignee") {
                    if !assignee.is_empty() {
                        data.insert("assignee".into(), Value::String(assignee));
                    }
                }
                let url = format!("{ASANA_BASE}/tasks/{}", encode_path(&task_id));
                let res = ctx
                    .http
                    .put(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "data": Value::Object(data) }))
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("task", "delete") => {
                let task_id = sub(ctx, params, "taskId")?;
                let url = format!("{ASANA_BASE}/tasks/{}", encode_path(&task_id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("task", "list") => {
                let project_id = sub(ctx, params, "projectId")?;
                let url = format!("{ASANA_BASE}/tasks");
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&[("project", project_id.as_str())])
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ----- PROJECT -----
            ("project", "create") => {
                let workspace = sub(ctx, params, "workspaceId")?;
                let team = sub(ctx, params, "teamId")?;
                let name = sub(ctx, params, "name")?;
                let data = json!({
                    "data": {
                        "workspace": workspace,
                        "team": team,
                        "name": name,
                    }
                });
                let url = format!("{ASANA_BASE}/projects");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&data)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("project", "get") => {
                let project_id = sub(ctx, params, "projectId")?;
                let url = format!("{ASANA_BASE}/projects/{}", encode_path(&project_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("project", "list") => {
                let workspace = sub(ctx, params, "workspaceId")?;
                let url = format!("{ASANA_BASE}/projects");
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&[("workspace", workspace.as_str())])
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("project", "delete") => {
                let project_id = sub(ctx, params, "projectId")?;
                let url = format!("{ASANA_BASE}/projects/{}", encode_path(&project_id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ----- WORKSPACE -----
            ("workspace", "list") => {
                let url = format!("{ASANA_BASE}/workspaces");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("workspace", "get") => {
                let workspace = sub(ctx, params, "workspaceId")?;
                let url = format!("{ASANA_BASE}/workspaces/{}", encode_path(&workspace));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ----- USER -----
            ("user", "me") => {
                let url = format!("{ASANA_BASE}/users/me");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("user", "get") => {
                let user_id = sub(ctx, params, "userId")?;
                let url = format!("{ASANA_BASE}/users/{}", encode_path(&user_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported combination: resource={r} operation={o}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

fn sub_opt(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<String> {
    ctx.param_str_opt(params, key).map(|raw| ctx.substitute(&raw))
}

fn encode_path(segment: &str) -> String {
    urlencoding::encode(segment).into_owned()
}

async fn json_or_err(res: reqwest::Response) -> NodeResult<Value> {
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
    serde_json::from_str(&text).map_err(NodeError::from)
}
