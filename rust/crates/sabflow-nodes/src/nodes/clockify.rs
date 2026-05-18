//! Clockify node — Clockify Time Tracking API
//! (`https://api.clockify.me/api/v1`).
//!
//! Auth: an API key from `https://app.clockify.me/user/settings`, sent as the
//! `X-Api-Key` header.  The linked credential's `data["apiKey"]` holds the
//! secret.
//!
//! Supported operations:
//!   - `workspace.list`                       → list workspaces
//!   - `project.list`, `project.create`       → workspace projects
//!   - `client.list`, `client.create`         → workspace clients
//!   - `timeEntry.list`, `timeEntry.start`,
//!     `timeEntry.stop`, `timeEntry.delete`   → time entries
//!   - `user.me`                              → authenticated user

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

const CLOCKIFY_BASE: &str = "https://api.clockify.me/api/v1";

pub struct ClockifyNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ClockifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "clockify",
            "Clockify",
            "Clockify time tracking",
            NodeCategory::Productivity,
        )
        .icon("clock")
        .color("#03A9F4")
        .credentials(vec![CredentialBinding {
            name: "clockifyApi".into(),
            display_name: "Clockify API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Workspaces", "workspace.list"),
                    opt("List Projects", "project.list"),
                    opt("Create Project", "project.create"),
                    opt("List Clients", "client.list"),
                    opt("Create Client", "client.create"),
                    opt("List Time Entries", "timeEntry.list"),
                    opt("Start Timer", "timeEntry.start"),
                    opt("Stop Timer", "timeEntry.stop"),
                    opt("Delete Time Entry", "timeEntry.delete"),
                    opt("Get Authenticated User", "user.me"),
                ])
                .default(json!("workspace.list"))
                .required(),
            NodeProperty::new("workspaceId", "Workspace ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &[
                        "project.list",
                        "project.create",
                        "client.list",
                        "client.create",
                        "timeEntry.list",
                        "timeEntry.start",
                        "timeEntry.stop",
                        "timeEntry.delete",
                    ],
                ),
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["timeEntry.list", "timeEntry.start", "timeEntry.stop"],
                )
                .description("Defaults to the authenticated user (`/user`)"),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["project.create", "client.create"]),
            NodeProperty::new("clientId", "Client ID", NodePropertyType::String)
                .show_when("operation", &["project.create"]),
            NodeProperty::new("billable", "Billable", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["project.create", "timeEntry.start"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["timeEntry.start"]),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .show_when("operation", &["timeEntry.start"]),
            NodeProperty::new("timeEntryId", "Time Entry ID", NodePropertyType::String)
                .show_when("operation", &["timeEntry.delete"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let api_key = ctx
            .credential(&cred_id)?
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "workspace.list" => {
                let url = format!("{CLOCKIFY_BASE}/workspaces");
                let res = ctx.http.get(&url).header("X-Api-Key", &api_key).send().await?;
                wrap(res).await
            }
            "user.me" => {
                let url = format!("{CLOCKIFY_BASE}/user");
                let res = ctx.http.get(&url).header("X-Api-Key", &api_key).send().await?;
                wrap(res).await
            }
            "project.list" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/projects",
                    urlencoding::encode(&ws)
                );
                let res = ctx.http.get(&url).header("X-Api-Key", &api_key).send().await?;
                wrap(res).await
            }
            "project.create" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let name = sub(ctx, params, "name")?;
                let mut body = Map::new();
                body.insert("name".into(), json!(name));
                if let Some(c) = sub_opt(ctx, params, "clientId") {
                    if !c.is_empty() {
                        body.insert("clientId".into(), json!(c));
                    }
                }
                body.insert("billable".into(), json!(ctx.param_bool(params, "billable", false)));
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/projects",
                    urlencoding::encode(&ws)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .header("X-Api-Key", &api_key)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            "client.list" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/clients",
                    urlencoding::encode(&ws)
                );
                let res = ctx.http.get(&url).header("X-Api-Key", &api_key).send().await?;
                wrap(res).await
            }
            "client.create" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let name = sub(ctx, params, "name")?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/clients",
                    urlencoding::encode(&ws)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .header("X-Api-Key", &api_key)
                    .json(&json!({ "name": name }))
                    .send()
                    .await?;
                wrap(res).await
            }
            "timeEntry.list" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let user_id = resolve_user_id(ctx, params, &api_key).await?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/user/{}/time-entries",
                    urlencoding::encode(&ws),
                    urlencoding::encode(&user_id),
                );
                let res = ctx.http.get(&url).header("X-Api-Key", &api_key).send().await?;
                wrap(res).await
            }
            "timeEntry.start" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let mut body = Map::new();
                body.insert("start".into(), json!(rfc3339_now()));
                if let Some(d) = sub_opt(ctx, params, "description") {
                    if !d.is_empty() {
                        body.insert("description".into(), json!(d));
                    }
                }
                if let Some(p) = sub_opt(ctx, params, "projectId") {
                    if !p.is_empty() {
                        body.insert("projectId".into(), json!(p));
                    }
                }
                body.insert("billable".into(), json!(ctx.param_bool(params, "billable", false)));
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/time-entries",
                    urlencoding::encode(&ws)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .header("X-Api-Key", &api_key)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            "timeEntry.stop" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let user_id = resolve_user_id(ctx, params, &api_key).await?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/user/{}/time-entries",
                    urlencoding::encode(&ws),
                    urlencoding::encode(&user_id),
                );
                let res = ctx
                    .http
                    .patch(&url)
                    .header("X-Api-Key", &api_key)
                    .json(&json!({ "end": rfc3339_now() }))
                    .send()
                    .await?;
                wrap(res).await
            }
            "timeEntry.delete" => {
                let ws = sub(ctx, params, "workspaceId")?;
                let id = sub(ctx, params, "timeEntryId")?;
                let url = format!(
                    "{CLOCKIFY_BASE}/workspaces/{}/time-entries/{}",
                    urlencoding::encode(&ws),
                    urlencoding::encode(&id),
                );
                let res = ctx
                    .http
                    .delete(&url)
                    .header("X-Api-Key", &api_key)
                    .send()
                    .await?;
                wrap_empty_ok(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

async fn resolve_user_id(
    ctx: &ExecutionContext,
    params: &Value,
    api_key: &str,
) -> NodeResult<String> {
    if let Some(u) = ctx.param_str_opt(params, "userId") {
        let u = ctx.substitute(&u);
        if !u.trim().is_empty() {
            return Ok(u);
        }
    }
    let url = format!("{CLOCKIFY_BASE}/user");
    let res = ctx.http.get(&url).header("X-Api-Key", api_key).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    v.get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| NodeError::MissingParameter("userId".into()))
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

/// RFC-3339 timestamp in UTC, second precision — Clockify accepts this.
fn rfc3339_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Compute Y/M/D/H/M/S from the unix timestamp (UTC).
    // We avoid pulling chrono — manual conversion is fine for our needs.
    let (y, m, d, hh, mm, ss) = unix_to_ymd_hms(secs as i64);
    format!("{y:04}-{m:02}-{d:02}T{hh:02}:{mm:02}:{ss:02}Z")
}

fn unix_to_ymd_hms(t: i64) -> (i64, u32, u32, u32, u32, u32) {
    let days = t.div_euclid(86_400);
    let rem = t.rem_euclid(86_400) as u32;
    let hh = rem / 3600;
    let mm = (rem % 3600) / 60;
    let ss = rem % 60;

    // Days since 1970-01-01 → civil date (algorithm from Howard Hinnant).
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let year = if month <= 2 { y + 1 } else { y };
    (year, month, day, hh, mm, ss)
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
