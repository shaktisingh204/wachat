//! Zoom node — meetings, users, webinars and recordings via the Zoom REST API.
//!
//! API base: https://api.zoom.us/v2
//! Auth: `Authorization: Bearer <access_token>` via the `zoomOAuth2` credential
//! (`accessToken` field). The access token is assumed to be already refreshed
//! by the credential layer.
//!
//! TODO(sabflow): implement OAuth2 refresh flow here when the credential
//! reports an expired token (currently we rely on a fresh `accessToken`).

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

const ZOOM_BASE: &str = "https://api.zoom.us/v2";

pub struct ZoomNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ZoomNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zoom",
            "Zoom",
            "Zoom meetings, webinars, users and cloud recordings",
            NodeCategory::Communication,
        )
        .icon("video")
        .color("#2D8CFF")
        .credentials(vec![CredentialBinding {
            name: "zoomOAuth2".into(),
            display_name: "Zoom OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Meeting", "meeting"),
                    opt("User", "user"),
                    opt("Webinar", "webinar"),
                    opt("Recording", "recording"),
                ])
                .default(json!("meeting"))
                .required(),
            // ── meeting operations ─────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["meeting"])
                .required(),
            // ── user operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Create", "create"),
                ])
                .default(json!("get"))
                .show_when("resource", &["user"])
                .required(),
            // ── webinar operations ─────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .show_when("resource", &["webinar"])
                .required(),
            // ── recording operations ───────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["recording"])
                .required(),
            // ── shared id parameters ───────────────────────────────────────────
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .placeholder("me")
                .default(json!("me"))
                .description("Zoom user ID or `me` for the authenticated user")
                .show_when(
                    "operation",
                    &["create", "list", "get"],
                ),
            NodeProperty::new("meetingId", "Meeting ID", NodePropertyType::String)
                .placeholder("123456789")
                .show_when("operation", &["get", "update", "delete"]),
            NodeProperty::new("webinarId", "Webinar ID", NodePropertyType::String)
                .placeholder("123456789")
                .show_when("operation", &["get"]),
            // ── meeting:create / meeting:update ───────────────────────────────
            NodeProperty::new("topic", "Topic", NodePropertyType::String)
                .placeholder("Weekly sync")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("meetingType", "Meeting Type", NodePropertyType::Number)
                .default(json!(2))
                .description(
                    "1 = instant, 2 = scheduled, 3 = recurring no-fixed-time, 8 = recurring fixed-time",
                )
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("startTime", "Start Time", NodePropertyType::String)
                .placeholder("2025-01-15T09:00:00Z")
                .description("ISO 8601 timestamp (UTC) — required for scheduled meetings/webinars")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("duration", "Duration (minutes)", NodePropertyType::Number)
                .default(json!(30))
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("timezone", "Timezone", NodePropertyType::String)
                .placeholder("UTC")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("password", "Password", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("agenda", "Agenda", NodePropertyType::String)
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("settings", "Additional Settings", NodePropertyType::Json)
                .default(json!({}))
                .description("Additional Zoom meeting/webinar `settings` object")
                .show_when("operation", &["create", "update"]),
            // ── user:create ────────────────────────────────────────────────────
            NodeProperty::new("action", "Action", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Auto Create", "autoCreate"),
                    opt("Custom Create", "custCreate"),
                    opt("SSO Create", "ssoCreate"),
                ])
                .default(json!("create"))
                .show_when("resource", &["user"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("resource", &["user"]),
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("resource", &["user"]),
            NodeProperty::new("lastName", "Last Name", NodePropertyType::String)
                .show_when("resource", &["user"]),
            NodeProperty::new("userType", "User Type", NodePropertyType::Number)
                .default(json!(1))
                .description("1 = Basic, 2 = Licensed, 3 = On-Prem")
                .show_when("resource", &["user"]),
            // ── pagination ─────────────────────────────────────────────────────
            NodeProperty::new("pageSize", "Page Size", NodePropertyType::Number)
                .default(json!(30))
                .show_when("operation", &["list"]),
            NodeProperty::new("nextPageToken", "Next Page Token", NodePropertyType::String)
                .show_when("operation", &["list"]),
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
            .unwrap_or_else(|| "meeting".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body = match (resource.as_str(), operation.as_str()) {
            // ─── Meetings ───────────────────────────────────────────────────
            ("meeting", "create") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let topic = ctx.substitute(&ctx.param_str(params, "topic")?);
                let meeting_type = ctx
                    .param_f64(params, "meetingType")
                    .map(|n| n as i64)
                    .unwrap_or(2);
                let start_time = ctx
                    .param_str_opt(params, "startTime")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let duration = ctx.param_f64(params, "duration").map(|n| n as i64);
                let timezone = ctx
                    .param_str_opt(params, "timezone")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let password = ctx
                    .param_str_opt(params, "password")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let agenda = ctx
                    .param_str_opt(params, "agenda")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());

                let mut payload = Map::new();
                payload.insert("topic".into(), json!(topic));
                payload.insert("type".into(), json!(meeting_type));
                if let Some(t) = start_time {
                    payload.insert("start_time".into(), json!(t));
                }
                if let Some(d) = duration {
                    payload.insert("duration".into(), json!(d));
                }
                if let Some(tz) = timezone {
                    payload.insert("timezone".into(), json!(tz));
                }
                if let Some(pw) = password {
                    payload.insert("password".into(), json!(pw));
                }
                if let Some(a) = agenda {
                    payload.insert("agenda".into(), json!(a));
                }
                if let Some(settings) = resolve_json(ctx, params.get("settings")) {
                    payload.insert("settings".into(), settings);
                }

                let url = format!("{ZOOM_BASE}/users/{user_id}/meetings");
                send_json(
                    zoom_req(ctx, &token, reqwest::Method::POST, &url),
                    &Value::Object(payload),
                )
                .await?
            }
            ("meeting", "get") => {
                let meeting_id = ctx.substitute(&ctx.param_str(params, "meetingId")?);
                let url = format!("{ZOOM_BASE}/meetings/{meeting_id}");
                send_no_body(zoom_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("meeting", "list") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let url = format!("{ZOOM_BASE}/users/{user_id}/meetings");
                let mut req = zoom_req(ctx, &token, reqwest::Method::GET, &url);
                req = apply_pagination(ctx, req, params);
                send_no_body(req).await?
            }
            ("meeting", "update") => {
                let meeting_id = ctx.substitute(&ctx.param_str(params, "meetingId")?);
                let mut payload = Map::new();
                if let Some(topic) = ctx
                    .param_str_opt(params, "topic")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("topic".into(), json!(topic));
                }
                if let Some(t) = ctx.param_f64(params, "meetingType") {
                    payload.insert("type".into(), json!(t as i64));
                }
                if let Some(start_time) = ctx
                    .param_str_opt(params, "startTime")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("start_time".into(), json!(start_time));
                }
                if let Some(d) = ctx.param_f64(params, "duration") {
                    payload.insert("duration".into(), json!(d as i64));
                }
                if let Some(tz) = ctx
                    .param_str_opt(params, "timezone")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("timezone".into(), json!(tz));
                }
                if let Some(pw) = ctx
                    .param_str_opt(params, "password")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("password".into(), json!(pw));
                }
                if let Some(a) = ctx
                    .param_str_opt(params, "agenda")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty())
                {
                    payload.insert("agenda".into(), json!(a));
                }
                if let Some(settings) = resolve_json(ctx, params.get("settings")) {
                    payload.insert("settings".into(), settings);
                }

                let url = format!("{ZOOM_BASE}/meetings/{meeting_id}");
                send_json(
                    zoom_req(ctx, &token, reqwest::Method::PATCH, &url),
                    &Value::Object(payload),
                )
                .await?
            }
            ("meeting", "delete") => {
                let meeting_id = ctx.substitute(&ctx.param_str(params, "meetingId")?);
                let url = format!("{ZOOM_BASE}/meetings/{meeting_id}");
                send_no_body(zoom_req(ctx, &token, reqwest::Method::DELETE, &url)).await?
            }

            // ─── Users ──────────────────────────────────────────────────────
            ("user", "get") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let url = format!("{ZOOM_BASE}/users/{user_id}");
                send_no_body(zoom_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("user", "list") => {
                let url = format!("{ZOOM_BASE}/users");
                let mut req = zoom_req(ctx, &token, reqwest::Method::GET, &url);
                req = apply_pagination(ctx, req, params);
                send_no_body(req).await?
            }
            ("user", "create") => {
                let email = ctx.substitute(&ctx.param_str(params, "email")?);
                let action = ctx
                    .param_str_opt(params, "action")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "create".to_string());
                let user_type = ctx.param_f64(params, "userType").map(|n| n as i64).unwrap_or(1);
                let first_name = ctx
                    .param_str_opt(params, "firstName")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let last_name = ctx
                    .param_str_opt(params, "lastName")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());

                let mut user_info = Map::new();
                user_info.insert("email".into(), json!(email));
                user_info.insert("type".into(), json!(user_type));
                if let Some(fn_) = first_name {
                    user_info.insert("first_name".into(), json!(fn_));
                }
                if let Some(ln) = last_name {
                    user_info.insert("last_name".into(), json!(ln));
                }

                let payload = json!({
                    "action": action,
                    "user_info": Value::Object(user_info),
                });
                let url = format!("{ZOOM_BASE}/users");
                send_json(zoom_req(ctx, &token, reqwest::Method::POST, &url), &payload).await?
            }

            // ─── Webinars ───────────────────────────────────────────────────
            ("webinar", "create") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let topic = ctx.substitute(&ctx.param_str(params, "topic")?);
                let start_time = ctx
                    .param_str_opt(params, "startTime")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let duration = ctx.param_f64(params, "duration").map(|n| n as i64);
                let timezone = ctx
                    .param_str_opt(params, "timezone")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let password = ctx
                    .param_str_opt(params, "password")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());
                let agenda = ctx
                    .param_str_opt(params, "agenda")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());

                let mut payload = Map::new();
                payload.insert("topic".into(), json!(topic));
                // Webinar type: 5 = scheduled (default for a date/time-bound webinar).
                let meeting_type = ctx
                    .param_f64(params, "meetingType")
                    .map(|n| n as i64)
                    .unwrap_or(5);
                payload.insert("type".into(), json!(meeting_type));
                if let Some(t) = start_time {
                    payload.insert("start_time".into(), json!(t));
                }
                if let Some(d) = duration {
                    payload.insert("duration".into(), json!(d));
                }
                if let Some(tz) = timezone {
                    payload.insert("timezone".into(), json!(tz));
                }
                if let Some(pw) = password {
                    payload.insert("password".into(), json!(pw));
                }
                if let Some(a) = agenda {
                    payload.insert("agenda".into(), json!(a));
                }
                if let Some(settings) = resolve_json(ctx, params.get("settings")) {
                    payload.insert("settings".into(), settings);
                }

                let url = format!("{ZOOM_BASE}/users/{user_id}/webinars");
                send_json(
                    zoom_req(ctx, &token, reqwest::Method::POST, &url),
                    &Value::Object(payload),
                )
                .await?
            }
            ("webinar", "get") => {
                let webinar_id = ctx.substitute(&ctx.param_str(params, "webinarId")?);
                let url = format!("{ZOOM_BASE}/webinars/{webinar_id}");
                send_no_body(zoom_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("webinar", "list") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let url = format!("{ZOOM_BASE}/users/{user_id}/webinars");
                let mut req = zoom_req(ctx, &token, reqwest::Method::GET, &url);
                req = apply_pagination(ctx, req, params);
                send_no_body(req).await?
            }

            // ─── Recordings ────────────────────────────────────────────────
            ("recording", "list") => {
                let user_id = ctx
                    .param_str_opt(params, "userId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "me".to_string());
                let user_id = ctx.substitute(&user_id);
                let url = format!("{ZOOM_BASE}/users/{user_id}/recordings");
                let mut req = zoom_req(ctx, &token, reqwest::Method::GET, &url);
                req = apply_pagination(ctx, req, params);
                send_no_body(req).await?
            }
            ("recording", "get") => {
                let meeting_id = ctx.substitute(&ctx.param_str(params, "meetingId")?);
                let url = format!("{ZOOM_BASE}/meetings/{meeting_id}/recordings");
                send_no_body(zoom_req(ctx, &token, reqwest::Method::GET, &url)).await?
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

// ─── helpers ────────────────────────────────────────────────────────────────

fn zoom_req(
    ctx: &ExecutionContext,
    token: &str,
    method: reqwest::Method,
    url: &str,
) -> RequestBuilder {
    ctx.http
        .request(method, url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
}

fn apply_pagination(
    ctx: &ExecutionContext,
    mut req: RequestBuilder,
    params: &Value,
) -> RequestBuilder {
    if let Some(page_size) = ctx.param_f64(params, "pageSize") {
        req = req.query(&[("page_size", (page_size as i64).to_string())]);
    }
    if let Some(token) = ctx
        .param_str_opt(params, "nextPageToken")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty())
    {
        req = req.query(&[("next_page_token", token)]);
    }
    req
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
    // Zoom returns empty bodies for some 204 responses (e.g. DELETE).
    let body: Value = if bytes.is_empty() {
        json!({ "success": status.is_success(), "status": status.as_u16() })
    } else {
        serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            Value::String(String::from_utf8_lossy(&bytes).into_owned())
        })
    };
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

/// Recursively substitute string leaves of a JSON value.
fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect()),
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
/// JSON-encoded string. Returns `None` for empty/blank.
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
