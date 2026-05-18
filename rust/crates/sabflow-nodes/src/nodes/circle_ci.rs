//! CircleCI node — pipeline, workflow, and job operations against the
//! CircleCI v2 REST API (`https://circleci.com/api/v2`).
//!
//! Authentication uses a personal API token stored on a `circleCiApi`
//! credential under `data["apiToken"]`, sent as the `Circle-Token` header.
//!
//! Supports:
//!   * Pipeline: trigger, get, getAll (by project)
//!   * Workflow: get, cancel, rerun, listJobs
//!   * Job: get, cancel
//!   * Project: getMe (current user's projects)

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

pub struct CircleCiNode;

const API_BASE: &str = "https://circleci.com/api/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CircleCiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "circleCi",
            "CircleCI",
            "Trigger pipelines and manage workflows on CircleCI",
            NodeCategory::Developer,
        )
        .icon("circle-play")
        .color("#161616")
        .credentials(vec![CredentialBinding {
            name: "circleCiApi".into(),
            display_name: "CircleCI API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Pipeline", "pipeline"),
                    opt("Workflow", "workflow"),
                    opt("Job", "job"),
                    opt("Project", "project"),
                ])
                .default(json!("pipeline"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Trigger", "trigger"),
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Cancel", "cancel"),
                    opt("Rerun", "rerun"),
                    opt("List Jobs", "listJobs"),
                    opt("Get Me", "getMe"),
                ])
                .default(json!("trigger"))
                .required(),
            NodeProperty::new("projectSlug", "Project Slug", NodePropertyType::String)
                .placeholder("gh/org/repo")
                .description(
                    "VCS / org / repo slug (e.g. `gh/my-org/my-repo` or `bb/my-org/my-repo`)",
                )
                .show_when(
                    "resource",
                    &["pipeline", "workflow", "job"],
                ),
            NodeProperty::new("branch", "Branch", NodePropertyType::String)
                .show_when("operation", &["trigger"])
                .placeholder("main"),
            NodeProperty::new("tag", "Tag", NodePropertyType::String)
                .show_when("operation", &["trigger"])
                .description("Mutually exclusive with branch"),
            NodeProperty::new("parameters", "Parameters", NodePropertyType::Json)
                .show_when("operation", &["trigger"])
                .description("JSON object of pipeline parameters"),
            // pipelineId is only used by `pipeline:get`; we gate on operation
            // since show_when can only carry one predicate at a time.
            NodeProperty::new("pipelineId", "Pipeline ID", NodePropertyType::String)
                .show_when("operation", &["get"]),
            NodeProperty::new("workflowId", "Workflow ID", NodePropertyType::String)
                .show_when("resource", &["workflow"]),
            NodeProperty::new("jobNumber", "Job Number", NodePropertyType::String)
                .show_when("resource", &["job"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "pipeline".to_string());
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ─────────────────────────── Pipeline ────────────────────────────
            ("pipeline", "trigger") => {
                let slug = require_slug(ctx, params)?;
                let mut payload = Map::new();
                if let Some(branch) = ctx.param_str_opt(params, "branch") {
                    if !branch.trim().is_empty() {
                        payload.insert("branch".into(), json!(branch));
                    }
                }
                if let Some(tag) = ctx.param_str_opt(params, "tag") {
                    if !tag.trim().is_empty() {
                        payload.insert("tag".into(), json!(tag));
                    }
                }
                if let Some(parameters) = parse_json_param(ctx, params, "parameters") {
                    payload.insert("parameters".into(), parameters);
                }
                let url = format!("{API_BASE}/project/{slug}/pipeline");
                send(ctx, &token, Method::POST, &url, Some(Value::Object(payload))).await
            }
            ("pipeline", "get") => {
                let id = require_param(ctx, params, "pipelineId")?;
                let url = format!("{API_BASE}/pipeline/{id}");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("pipeline", "getAll") => {
                let slug = require_slug(ctx, params)?;
                let url = format!("{API_BASE}/project/{slug}/pipeline");
                send(ctx, &token, Method::GET, &url, None).await
            }

            // ─────────────────────────── Workflow ────────────────────────────
            ("workflow", "get") => {
                let id = require_param(ctx, params, "workflowId")?;
                let url = format!("{API_BASE}/workflow/{id}");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("workflow", "cancel") => {
                let id = require_param(ctx, params, "workflowId")?;
                let url = format!("{API_BASE}/workflow/{id}/cancel");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }
            ("workflow", "rerun") => {
                let id = require_param(ctx, params, "workflowId")?;
                let url = format!("{API_BASE}/workflow/{id}/rerun");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }
            ("workflow", "listJobs") => {
                let id = require_param(ctx, params, "workflowId")?;
                let url = format!("{API_BASE}/workflow/{id}/job");
                send(ctx, &token, Method::GET, &url, None).await
            }

            // ───────────────────────────── Job ───────────────────────────────
            ("job", "get") => {
                let slug = require_slug(ctx, params)?;
                let number = require_param(ctx, params, "jobNumber")?;
                let url = format!("{API_BASE}/project/{slug}/job/{number}");
                send(ctx, &token, Method::GET, &url, None).await
            }
            ("job", "cancel") => {
                let slug = require_slug(ctx, params)?;
                let number = require_param(ctx, params, "jobNumber")?;
                let url = format!("{API_BASE}/project/{slug}/job/{number}/cancel");
                send(ctx, &token, Method::POST, &url, Some(json!({}))).await
            }

            // ─────────────────────────── Project ─────────────────────────────
            ("project", "getMe") => {
                // Returns the authenticated user's profile (includes project follows).
                let url = format!("{API_BASE}/me");
                send(ctx, &token, Method::GET, &url, None).await
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

fn require_slug(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    let raw = ctx.param_str(params, "projectSlug")?;
    let v = ctx.substitute(&raw);
    let trimmed = v.trim().trim_matches('/');
    if trimmed.is_empty() {
        return Err(NodeError::MissingParameter("projectSlug".into()));
    }
    // CircleCI slugs are passed as `gh/org/repo` — three segments, no leading slash.
    Ok(trimmed.to_string())
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
        .header("Circle-Token", token)
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
    // CircleCI list endpoints wrap items under `items` — unwrap so consumers
    // get an array of items, not a single envelope object.
    let items = match parsed {
        Value::Array(a) => a,
        Value::Null => vec![],
        Value::Object(ref map) if map.contains_key("items") => match map.get("items").cloned() {
            Some(Value::Array(a)) => a,
            _ => vec![parsed],
        },
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
