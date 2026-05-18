//! Microsoft Outlook node — mail + calendar via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `Authorization: Bearer <accessToken>` from the
//! `microsoftOAuth2Api` credential (`accessToken` field on the decrypted
//! credential record). Token refresh is handled upstream — same convention
//! as [`super::gmail`].
//!
//! Resources / operations implemented:
//!   - message.send         POST `/me/sendMail`
//!   - message.list         GET  `/me/messages?$top=N`
//!   - message.get          GET  `/me/messages/{id}`
//!   - message.delete       DELETE `/me/messages/{id}`
//!   - event.create         POST `/me/events`
//!   - event.list           GET  `/me/events?$top=N`
//!   - event.delete         DELETE `/me/events/{id}`

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

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

pub struct MicrosoftOutlookNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftOutlookNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftOutlook",
            "Microsoft Outlook",
            "Send mail and manage events via Microsoft Graph",
            NodeCategory::Communication,
        )
        .icon("mail")
        .color("#0078D4")
        .credentials(vec![CredentialBinding {
            name: "microsoftOAuth2Api".into(),
            display_name: "Microsoft OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Message", "message"), opt("Event", "event")])
                .default(json!("message"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send", "send"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Delete", "delete"),
                    opt("Create", "create"),
                ])
                .default(json!("send"))
                .required(),
            // ── message.send ───────────────────────────────────────────────
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("alice@example.com,bob@example.com")
                .show_when("operation", &["send"]),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("operation", &["send", "create"]),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .show_when("operation", &["send", "create"]),
            NodeProperty::new("bodyContentType", "Body Content Type", NodePropertyType::Options)
                .options(vec![opt("HTML", "HTML"), opt("Text", "Text")])
                .default(json!("Text"))
                .show_when("operation", &["send", "create"]),
            // ── ids ────────────────────────────────────────────────────────
            NodeProperty::new("messageId", "Message ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete"]),
            NodeProperty::new("eventId", "Event ID", NodePropertyType::String)
                .show_when("operation", &["delete"]),
            // ── event.create ───────────────────────────────────────────────
            NodeProperty::new("startDateTime", "Start (ISO 8601)", NodePropertyType::String)
                .placeholder("2026-05-20T10:00:00")
                .show_when("operation", &["create"]),
            NodeProperty::new("endDateTime", "End (ISO 8601)", NodePropertyType::String)
                .placeholder("2026-05-20T11:00:00")
                .show_when("operation", &["create"]),
            NodeProperty::new("timeZone", "Time Zone", NodePropertyType::String)
                .default(json!("UTC"))
                .show_when("operation", &["create"]),
            NodeProperty::new("attendees", "Attendees (comma-separated)", NodePropertyType::String)
                .show_when("operation", &["create"]),
            // ── list ───────────────────────────────────────────────────────
            NodeProperty::new("top", "Max Results", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["list"]),
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
            ("message", "send") => {
                let to = ctx.param_str(params, "to")?;
                let subject = ctx.param_str(params, "subject")?;
                let body = ctx.param_str(params, "body")?;
                let content_type = ctx
                    .param_str_opt(params, "bodyContentType")
                    .unwrap_or_else(|| "Text".to_string());
                let payload = json!({
                    "message": {
                        "subject": subject,
                        "body": { "contentType": content_type, "content": body },
                        "toRecipients": split_recipients(&to),
                    },
                    "saveToSentItems": true,
                });
                let url = format!("{GRAPH_BASE}/me/sendMail");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit_or_ack(res, json!({ "sent": true })).await
            }
            ("message", "get") => {
                let id = ctx.param_str(params, "messageId")?;
                let url = format!("{GRAPH_BASE}/me/messages/{}", urlencode_path(&id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("message", "list") => {
                let top = ctx.param_f64(params, "top").unwrap_or(50.0) as u64;
                let url = format!("{GRAPH_BASE}/me/messages?$top={top}");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("message", "delete") => {
                let id = ctx.param_str(params, "messageId")?;
                let url = format!("{GRAPH_BASE}/me/messages/{}", urlencode_path(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": id })).await
            }
            ("event", "create") => {
                let subject = ctx.param_str(params, "subject")?;
                let body = ctx.param_str_opt(params, "body").unwrap_or_default();
                let content_type = ctx
                    .param_str_opt(params, "bodyContentType")
                    .unwrap_or_else(|| "Text".to_string());
                let start = ctx.param_str(params, "startDateTime")?;
                let end = ctx.param_str(params, "endDateTime")?;
                let tz = ctx
                    .param_str_opt(params, "timeZone")
                    .unwrap_or_else(|| "UTC".to_string());
                let attendees_raw = ctx.param_str_opt(params, "attendees").unwrap_or_default();
                let attendees: Vec<Value> = attendees_raw
                    .split([',', ';', '\n'])
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|addr| {
                        json!({
                            "emailAddress": { "address": addr },
                            "type": "required",
                        })
                    })
                    .collect();
                let payload = json!({
                    "subject": subject,
                    "body": { "contentType": content_type, "content": body },
                    "start": { "dateTime": start, "timeZone": tz },
                    "end":   { "dateTime": end,   "timeZone": tz },
                    "attendees": attendees,
                });
                let url = format!("{GRAPH_BASE}/me/events");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("event", "list") => {
                let top = ctx.param_f64(params, "top").unwrap_or(50.0) as u64;
                let url = format!("{GRAPH_BASE}/me/events?$top={top}");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("event", "delete") => {
                let id = ctx.param_str(params, "eventId")?;
                let url = format!("{GRAPH_BASE}/me/events/{}", urlencode_path(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": id })).await
            }
            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported resource/operation combination: {r}/{o}"),
            }),
        }
    }
}

// ─── shared helpers ────────────────────────────────────────────────────────

pub(crate) fn ms_bearer_token(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    let cred_id = ctx.param_str(params, "credentialId")?;
    let cred = ctx.credential(&cred_id)?;
    cred.data
        .get("accessToken")
        .cloned()
        .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))
}

pub(crate) async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
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

/// Like [`emit`] but returns a synthetic ack value when the upstream returns
/// an empty success body (e.g. 202 Accepted, 204 No Content).
pub(crate) async fn emit_or_ack(res: reqwest::Response, ack: Value) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        let body: Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    if text.trim().is_empty() {
        return Ok(NodeOutput::single(vec![ack]));
    }
    let body: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text }));
    Ok(NodeOutput::single(vec![body]))
}

/// Percent-encode a URL path segment.
pub(crate) fn urlencode_path(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        let c = *b;
        let safe =
            c.is_ascii_alphanumeric() || c == b'-' || c == b'_' || c == b'.' || c == b'~';
        if safe {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}

fn split_recipients(raw: &str) -> Vec<Value> {
    raw.split([',', ';', '\n'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|addr| json!({ "emailAddress": { "address": addr } }))
        .collect()
}
