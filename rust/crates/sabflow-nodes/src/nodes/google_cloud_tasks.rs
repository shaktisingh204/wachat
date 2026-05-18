//! Google Cloud Tasks node.
//!
//! Implements the Cloud Tasks REST API (v2) for queue + task management:
//!   - queue list / get
//!   - task list / get / create / delete
//!
//! Task creation here uses the HTTP-target shape (most common for SabFlow);
//! the payload is passed through as a JSON body the workers will receive.
//!
//! Authentication: pre-refreshed OAuth2 bearer token at
//! `cred.data["accessToken"]` with the
//! `https://www.googleapis.com/auth/cloud-tasks` scope.

use async_trait::async_trait;
use base64::Engine as _;
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

pub struct GoogleCloudTasksNode;

const BASE_URL: &str = "https://cloudtasks.googleapis.com/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleCloudTasksNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleCloudTasks",
            "Google Cloud Tasks",
            "Enqueue and manage tasks on Google Cloud Tasks",
            NodeCategory::Developer,
        )
        .icon("list-checks")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleCloudTasksOAuth2".into(),
            display_name: "Google Cloud Tasks OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("my-gcp-project")
                .required(),
            NodeProperty::new("location", "Location", NodePropertyType::String)
                .placeholder("us-central1")
                .required()
                .description("GCP region the Cloud Tasks queue lives in."),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Queue", "queue"), opt("Task", "task")])
                .default(json!("task"))
                .required(),
            // ── Queue operations ───────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["queue"])
                .required(),
            // ── Task operations ────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create (HTTP)", "create"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["task"])
                .required(),
            NodeProperty::new("queueId", "Queue ID", NodePropertyType::String)
                .placeholder("my-queue")
                .show_when(
                    "operation",
                    &["get", "list", "create", "delete"],
                )
                .description("Queue identifier within the chosen location."),
            NodeProperty::new("taskId", "Task ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete"])
                .description("Required for get/delete operations."),
            NodeProperty::new("httpUrl", "HTTP URL", NodePropertyType::String)
                .placeholder("https://worker.example.com/handle")
                .show_when("operation", &["create"])
                .description("URL the task should call when it executes."),
            NodeProperty::new("httpMethod", "HTTP Method", NodePropertyType::Options)
                .options(vec![
                    opt("POST", "POST"),
                    opt("GET", "GET"),
                    opt("PUT", "PUT"),
                    opt("DELETE", "DELETE"),
                    opt("PATCH", "PATCH"),
                ])
                .default(json!("POST"))
                .show_when("operation", &["create"]),
            NodeProperty::new("body", "Body (JSON)", NodePropertyType::Json)
                .description("Optional JSON body sent to the HTTP target.")
                .show_when("operation", &["create"]),
            NodeProperty::new("scheduleSeconds", "Schedule Delay (seconds)", NodePropertyType::Number)
                .default(json!(0))
                .show_when("operation", &["create"])
                .description("Delay before the task is eligible to run (epoch + delay)."),
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

        let project_id = ctx.param_str(params, "projectId")?;
        let location = ctx.param_str(params, "location")?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        let parent_base = format!(
            "projects/{}/locations/{}",
            project_id, location
        );

        match (resource.as_str(), operation.as_str()) {
            ("queue", "list") => {
                let url = format!(
                    "{BASE_URL}/{}/queues",
                    encode_path(&parent_base)
                );
                get_json(ctx, &token, &url).await
            }
            ("queue", "get") => {
                let queue = ctx.param_str(params, "queueId")?;
                let url = format!(
                    "{BASE_URL}/{}/queues/{}",
                    encode_path(&parent_base),
                    urlencoding::encode(&queue)
                );
                get_json(ctx, &token, &url).await
            }
            ("task", "list") => {
                let queue = ctx.param_str(params, "queueId")?;
                let url = format!(
                    "{BASE_URL}/{}/queues/{}/tasks",
                    encode_path(&parent_base),
                    urlencoding::encode(&queue)
                );
                get_json(ctx, &token, &url).await
            }
            ("task", "get") => {
                let queue = ctx.param_str(params, "queueId")?;
                let task = ctx.param_str(params, "taskId")?;
                let url = format!(
                    "{BASE_URL}/{}/queues/{}/tasks/{}",
                    encode_path(&parent_base),
                    urlencoding::encode(&queue),
                    urlencoding::encode(&task)
                );
                get_json(ctx, &token, &url).await
            }
            ("task", "create") => {
                let queue = ctx.param_str(params, "queueId")?;
                let http_url = ctx.param_str(params, "httpUrl")?;
                let method = ctx
                    .param_str_opt(params, "httpMethod")
                    .unwrap_or_else(|| "POST".to_string());
                let body = parse_json_param(ctx, params, "body");
                let delay_secs = ctx
                    .param_f64(params, "scheduleSeconds")
                    .map(|n| n as i64)
                    .unwrap_or(0);

                let mut http_req = Map::new();
                http_req.insert("url".into(), Value::String(http_url));
                http_req.insert("httpMethod".into(), Value::String(method));
                if let Some(b) = body {
                    let encoded = base64::engine::general_purpose::STANDARD
                        .encode(b.to_string().as_bytes());
                    http_req.insert("body".into(), Value::String(encoded));
                    let mut headers = Map::new();
                    headers.insert(
                        "Content-Type".into(),
                        Value::String("application/json".into()),
                    );
                    http_req.insert("headers".into(), Value::Object(headers));
                }

                let mut task_obj = Map::new();
                task_obj.insert("httpRequest".into(), Value::Object(http_req));
                if delay_secs > 0 {
                    let ts = chrono::Utc::now() + chrono::Duration::seconds(delay_secs);
                    task_obj.insert(
                        "scheduleTime".into(),
                        Value::String(ts.to_rfc3339()),
                    );
                }

                let payload = json!({ "task": Value::Object(task_obj) });
                let url = format!(
                    "{BASE_URL}/{}/queues/{}/tasks",
                    encode_path(&parent_base),
                    urlencoding::encode(&queue)
                );
                post_json(ctx, &token, &url, payload).await
            }
            ("task", "delete") => {
                let queue = ctx.param_str(params, "queueId")?;
                let task = ctx.param_str(params, "taskId")?;
                let url = format!(
                    "{BASE_URL}/{}/queues/{}/tasks/{}",
                    encode_path(&parent_base),
                    urlencoding::encode(&queue),
                    urlencoding::encode(&task)
                );
                delete_request(ctx, &token, &url).await
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported Cloud Tasks operation: {res}/{op}"),
            }),
        }
    }
}

/// Per-segment percent-encoding for resource paths like
/// `projects/.../locations/...`. We preserve `/` so the parent expression
/// stays intact.
fn encode_path(path: &str) -> String {
    path.split('/')
        .map(|seg| urlencoding::encode(seg).into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<NodeOutput> {
    emit(ctx.http.get(url).bearer_auth(token).send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<NodeOutput> {
    emit(
        ctx.http
            .post(url)
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await?,
    )
    .await
}

async fn delete_request(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx.http.delete(url).bearer_auth(token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(NodeOutput::single(vec![json!({ "deleted": true })]))
}

async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}

fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
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
