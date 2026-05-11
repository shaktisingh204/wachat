//! Calendly node.
//!
//! Implements scheduling operations against the Calendly API
//! (https://api.calendly.com). Authenticates with a personal access token
//! (Bearer) supplied via the `calendlyApi` credential (`accessToken` field).

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
};

pub struct CalendlyNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const CALENDLY_API_BASE: &str = "https://api.calendly.com";

#[async_trait]
impl Node for CalendlyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "calendly",
            "Calendly",
            "Calendly meeting scheduling",
            NodeCategory::Productivity,
        )
        .icon("calendar")
        .color("#006BFF")
        .credentials(vec![CredentialBinding {
            name: "calendlyApi".into(),
            display_name: "Calendly Personal Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get Current User", "getCurrentUser"),
                    opt("Get User", "getUser"),
                    opt("List Event Types", "listEventTypes"),
                    opt("List Scheduled Events", "listScheduledEvents"),
                    opt("Get Event", "getEvent"),
                    opt("Cancel Event", "cancelEvent"),
                    opt("List Event Invitees", "listEventInvitees"),
                    opt(
                        "Create Single-Use Scheduling Link",
                        "createSingleUseSchedulingLink",
                    ),
                ])
                .default(json!("getCurrentUser"))
                .required(),
            NodeProperty::new("userUri", "User URI or ID", NodePropertyType::String)
                .placeholder("https://api.calendly.com/users/AAAAAAAAAAAAAAAA")
                .description("Full user URI, or just the UUID — both accepted.")
                .show_when(
                    "operation",
                    &["getUser", "listEventTypes", "listScheduledEvents"],
                )
                .required(),
            NodeProperty::new("status", "Status Filter", NodePropertyType::Options)
                .options(vec![
                    opt("Any", ""),
                    opt("Active", "active"),
                    opt("Canceled", "canceled"),
                ])
                .default(json!(""))
                .show_when("operation", &["listScheduledEvents"]),
            NodeProperty::new("eventUuid", "Event UUID", NodePropertyType::String)
                .placeholder("AAAAAAAAAAAAAAAA")
                .show_when(
                    "operation",
                    &["getEvent", "cancelEvent", "listEventInvitees"],
                )
                .required(),
            NodeProperty::new("reason", "Cancellation Reason", NodePropertyType::String)
                .placeholder("Rescheduling")
                .show_when("operation", &["cancelEvent"]),
            NodeProperty::new("maxEventCount", "Max Event Count", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["createSingleUseSchedulingLink"])
                .required(),
            NodeProperty::new("ownerUri", "Owner URI", NodePropertyType::String)
                .placeholder("https://api.calendly.com/event_types/AAAAAAAAAAAAAAAA")
                .description("URI of the EventType (or User) that owns the link.")
                .show_when("operation", &["createSingleUseSchedulingLink"])
                .required(),
            NodeProperty::new("ownerType", "Owner Type", NodePropertyType::Options)
                .options(vec![opt("Event Type", "EventType"), opt("User", "User")])
                .default(json!("EventType"))
                .show_when("operation", &["createSingleUseSchedulingLink"])
                .required(),
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

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "getCurrentUser" => {
                let url = format!("{CALENDLY_API_BASE}/users/me");
                get_json(ctx, &token, &url).await?
            }
            "getUser" => {
                let raw = ctx.param_str(params, "userUri")?;
                let user_id = extract_id(&raw);
                let url = format!("{CALENDLY_API_BASE}/users/{user_id}");
                get_json(ctx, &token, &url).await?
            }
            "listEventTypes" => {
                let user_uri = expand_user_uri(&ctx.param_str(params, "userUri")?);
                let encoded = urlencoding::encode(&user_uri);
                let url = format!("{CALENDLY_API_BASE}/event_types?user={encoded}");
                get_json(ctx, &token, &url).await?
            }
            "listScheduledEvents" => {
                let user_uri = expand_user_uri(&ctx.param_str(params, "userUri")?);
                let encoded_user = urlencoding::encode(&user_uri);
                let mut url = format!("{CALENDLY_API_BASE}/scheduled_events?user={encoded_user}");
                if let Some(status) = ctx.param_str_opt(params, "status") {
                    let status = status.trim();
                    if !status.is_empty() {
                        let encoded_status = urlencoding::encode(status);
                        url.push_str(&format!("&status={encoded_status}"));
                    }
                }
                get_json(ctx, &token, &url).await?
            }
            "getEvent" => {
                let uuid = ctx.param_str(params, "eventUuid")?;
                let uuid = extract_id(&uuid);
                let url = format!("{CALENDLY_API_BASE}/scheduled_events/{uuid}");
                get_json(ctx, &token, &url).await?
            }
            "cancelEvent" => {
                let uuid = ctx.param_str(params, "eventUuid")?;
                let uuid = extract_id(&uuid);
                let url = format!("{CALENDLY_API_BASE}/scheduled_events/{uuid}/cancellation");
                let mut payload = json!({});
                if let Some(reason) = ctx.param_str_opt(params, "reason") {
                    let reason = reason.trim();
                    if !reason.is_empty() {
                        payload = json!({ "reason": reason });
                    }
                }
                post_json(ctx, &token, &url, payload).await?
            }
            "listEventInvitees" => {
                let uuid = ctx.param_str(params, "eventUuid")?;
                let uuid = extract_id(&uuid);
                let url = format!("{CALENDLY_API_BASE}/scheduled_events/{uuid}/invitees");
                get_json(ctx, &token, &url).await?
            }
            "createSingleUseSchedulingLink" => {
                let max = ctx
                    .param_f64(params, "maxEventCount")
                    .map(|n| n as u64)
                    .unwrap_or(1);
                let owner_uri = ctx.param_str(params, "ownerUri")?;
                let owner_type = ctx
                    .param_str_opt(params, "ownerType")
                    .unwrap_or_else(|| "EventType".to_string());
                let payload = json!({
                    "max_event_count": max,
                    "owner": owner_uri,
                    "owner_type": owner_type,
                });
                let url = format!("{CALENDLY_API_BASE}/scheduling_links");
                post_json(ctx, &token, &url, payload).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

/// If the caller passes a full Calendly URI, pull the trailing segment.
/// Otherwise return the value as-is (assumed to be the UUID).
fn extract_id(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if let Some(idx) = trimmed.rfind('/') {
        trimmed[idx + 1..].to_string()
    } else {
        trimmed.to_string()
    }
}

/// Calendly endpoints that filter by `user` need a full URI. If the caller
/// passed a bare UUID, expand it into `https://api.calendly.com/users/<uuid>`.
fn expand_user_uri(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("{CALENDLY_API_BASE}/users/{trimmed}")
    }
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<Value> {
    let res = ctx.http.get(url).bearer_auth(token).send().await?;
    finalize_response(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .post(url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}
