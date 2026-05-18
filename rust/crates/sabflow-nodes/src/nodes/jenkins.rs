//! Jenkins node — interact with a Jenkins server over its REST API.
//!
//! Authentication uses Basic Auth with `username` + `apiToken` stored on a
//! `jenkinsApi` credential. The credential also carries `baseUrl` (e.g.
//! `https://ci.example.com`) which is the root of the Jenkins instance.
//!
//! Supports the most common job-control operations:
//!   * Job: get, getAll, build (no params), buildWithParameters, enable, disable
//!   * Build: get, stop, getConsole (plain-text output)
//!   * Queue: get
//!   * Instance: getInfo (system info)
//!
//! Most JSON endpoints use the `/api/json` suffix Jenkins requires.

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

pub struct JenkinsNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for JenkinsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jenkins",
            "Jenkins",
            "Trigger jobs and inspect builds on a Jenkins server",
            NodeCategory::Developer,
        )
        .icon("hammer")
        .color("#D33833")
        .credentials(vec![CredentialBinding {
            name: "jenkinsApi".into(),
            display_name: "Jenkins API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Job", "job"),
                    opt("Build", "build"),
                    opt("Queue", "queue"),
                    opt("Instance", "instance"),
                ])
                .default(json!("job"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Get All", "getAll"),
                    opt("Build", "build"),
                    opt("Build With Parameters", "buildWithParameters"),
                    opt("Enable", "enable"),
                    opt("Disable", "disable"),
                    opt("Stop", "stop"),
                    opt("Get Console Output", "getConsole"),
                    opt("Get Info", "getInfo"),
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("jobName", "Job Name", NodePropertyType::String)
                .placeholder("my-pipeline")
                .show_when("resource", &["job", "build"]),
            NodeProperty::new("buildNumber", "Build Number", NodePropertyType::String)
                .show_when("resource", &["build"])
                .description("Numeric build id or `lastBuild`, `lastSuccessfulBuild`, etc."),
            NodeProperty::new("queueId", "Queue Item ID", NodePropertyType::String)
                .show_when("resource", &["queue"]),
            NodeProperty::new("parameters", "Parameters", NodePropertyType::Json)
                .show_when("operation", &["buildWithParameters"])
                .description("JSON object of parameter name → value"),
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
        let username = cred
            .data
            .get("username")
            .ok_or_else(|| NodeError::MissingParameter("username".into()))?
            .clone();
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();
        let base = cred
            .data
            .get("baseUrl")
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?;

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "job".to_string());
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ───────────────────────────── Job ─────────────────────────────
            ("job", "get") => {
                let name = require_param(ctx, params, "jobName")?;
                let url = format!(
                    "{base}/job/{}/api/json",
                    urlencoding::encode(&name)
                );
                send_json(ctx, &username, &api_token, Method::GET, &url, None).await
            }
            ("job", "getAll") => {
                let url = format!("{base}/api/json?tree=jobs[name,url,color]");
                send_json(ctx, &username, &api_token, Method::GET, &url, None).await
            }
            ("job", "build") => {
                let name = require_param(ctx, params, "jobName")?;
                let url = format!("{base}/job/{}/build", urlencoding::encode(&name));
                send_json(ctx, &username, &api_token, Method::POST, &url, None).await
            }
            ("job", "buildWithParameters") => {
                let name = require_param(ctx, params, "jobName")?;
                let url = format!(
                    "{base}/job/{}/buildWithParameters",
                    urlencoding::encode(&name)
                );
                let parameters = parse_json_param(ctx, params, "parameters")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let Value::Object(map) = parameters else {
                    return Err(NodeError::InvalidParameter {
                        name: "parameters".into(),
                        reason: "expected a JSON object".into(),
                    });
                };
                // Jenkins parameterised builds accept a form-encoded body.
                let pairs: Vec<(String, String)> = map
                    .into_iter()
                    .map(|(k, v)| {
                        let s = match v {
                            Value::String(s) => s,
                            other => other.to_string(),
                        };
                        (k, s)
                    })
                    .collect();
                send_form(ctx, &username, &api_token, &url, &pairs).await
            }
            ("job", "enable") => {
                let name = require_param(ctx, params, "jobName")?;
                let url = format!("{base}/job/{}/enable", urlencoding::encode(&name));
                send_json(ctx, &username, &api_token, Method::POST, &url, None).await
            }
            ("job", "disable") => {
                let name = require_param(ctx, params, "jobName")?;
                let url = format!("{base}/job/{}/disable", urlencoding::encode(&name));
                send_json(ctx, &username, &api_token, Method::POST, &url, None).await
            }

            // ──────────────────────────── Build ────────────────────────────
            ("build", "get") => {
                let name = require_param(ctx, params, "jobName")?;
                let n = require_param(ctx, params, "buildNumber")?;
                let url = format!(
                    "{base}/job/{}/{}/api/json",
                    urlencoding::encode(&name),
                    urlencoding::encode(&n)
                );
                send_json(ctx, &username, &api_token, Method::GET, &url, None).await
            }
            ("build", "stop") => {
                let name = require_param(ctx, params, "jobName")?;
                let n = require_param(ctx, params, "buildNumber")?;
                let url = format!(
                    "{base}/job/{}/{}/stop",
                    urlencoding::encode(&name),
                    urlencoding::encode(&n)
                );
                send_json(ctx, &username, &api_token, Method::POST, &url, None).await
            }
            ("build", "getConsole") => {
                let name = require_param(ctx, params, "jobName")?;
                let n = require_param(ctx, params, "buildNumber")?;
                let url = format!(
                    "{base}/job/{}/{}/consoleText",
                    urlencoding::encode(&name),
                    urlencoding::encode(&n)
                );
                let text = send_text(ctx, &username, &api_token, Method::GET, &url).await?;
                Ok(NodeOutput::single(vec![json!({ "consoleOutput": text })]))
            }

            // ──────────────────────────── Queue ────────────────────────────
            ("queue", "get") => {
                let id = require_param(ctx, params, "queueId")?;
                let url = format!("{base}/queue/item/{id}/api/json");
                send_json(ctx, &username, &api_token, Method::GET, &url, None).await
            }

            // ─────────────────────────── Instance ──────────────────────────
            ("instance", "getInfo") => {
                let url = format!("{base}/api/json");
                send_json(ctx, &username, &api_token, Method::GET, &url, None).await
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

async fn send_json(
    ctx: &ExecutionContext,
    user: &str,
    token: &str,
    method: Method,
    url: &str,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let mut req: RequestBuilder = ctx
        .http
        .request(method, url)
        .basic_auth(user, Some(token))
        .header("Accept", "application/json");
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: String::from_utf8_lossy(&bytes).into_owned(),
        });
    }
    // Many Jenkins endpoints return 200/201 with an empty body (e.g. `POST /build`).
    // Surface the response status + Location header so the caller can poll the queue.
    let parsed: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes).unwrap_or_else(|_| {
            Value::String(String::from_utf8_lossy(&bytes).into_owned())
        })
    };
    let items = match parsed {
        Value::Null => vec![json!({ "status": status.as_u16() })],
        Value::Array(a) => a,
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}

async fn send_form(
    ctx: &ExecutionContext,
    user: &str,
    token: &str,
    url: &str,
    pairs: &[(String, String)],
) -> NodeResult<NodeOutput> {
    let res = ctx
        .http
        .post(url)
        .basic_auth(user, Some(token))
        .form(pairs)
        .send()
        .await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: String::from_utf8_lossy(&bytes).into_owned(),
        });
    }
    Ok(NodeOutput::single(vec![
        json!({ "status": status.as_u16() }),
    ]))
}

async fn send_text(
    ctx: &ExecutionContext,
    user: &str,
    token: &str,
    method: Method,
    url: &str,
) -> NodeResult<String> {
    let res = ctx
        .http
        .request(method, url)
        .basic_auth(user, Some(token))
        .send()
        .await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(text)
}
