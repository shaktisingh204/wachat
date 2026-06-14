//! Interactive message sends — `POST /{phone-number-id}/messages` with
//! `type:"interactive"`.
//!
//! Typed builders for the two most common new interactive types (CTA-URL button
//! and location-request), plus a passthrough for any interactive object the
//! frontend assembles (list, reply buttons, flow, webview).

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

pub(crate) fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

#[derive(Debug, Clone, Serialize)]
pub struct SendResponse {
    pub message_id: Option<String>,
    pub raw: Value,
}

fn message_id_of(raw: &Value) -> Option<String> {
    raw.get("messages")
        .and_then(|m| m.get(0))
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
}

async fn post_interactive(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    to: &str,
    interactive: Value,
) -> Result<SendResponse> {
    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": interactive,
    });
    let path = format!("{phone_number_id}/messages");
    let raw: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(SendResponse {
        message_id: message_id_of(&raw),
        raw,
    })
}

// -- CTA-URL button ---------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CtaUrlBody {
    pub phone_number_id: String,
    pub to: String,
    pub body_text: String,
    pub display_text: String,
    pub url: String,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub footer_text: Option<String>,
}

pub async fn cta_url(meta: &MetaClient, project: &Project, body: CtaUrlBody) -> Result<SendResponse> {
    let mut interactive = Map::new();
    interactive.insert("type".into(), Value::String("cta_url".into()));
    if let Some(h) = body.header_text {
        interactive.insert("header".into(), json!({ "type": "text", "text": h }));
    }
    interactive.insert("body".into(), json!({ "text": body.body_text }));
    if let Some(f) = body.footer_text {
        interactive.insert("footer".into(), json!({ "text": f }));
    }
    interactive.insert(
        "action".into(),
        json!({
            "name": "cta_url",
            "parameters": { "display_text": body.display_text, "url": body.url }
        }),
    );
    post_interactive(
        meta,
        project,
        &body.phone_number_id,
        &body.to,
        Value::Object(interactive),
    )
    .await
}

// -- Location request -------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationRequestBody {
    pub phone_number_id: String,
    pub to: String,
    pub body_text: String,
}

pub async fn location_request(
    meta: &MetaClient,
    project: &Project,
    body: LocationRequestBody,
) -> Result<SendResponse> {
    let interactive = json!({
        "type": "location_request_message",
        "body": { "text": body.body_text },
        "action": { "name": "send_location" }
    });
    post_interactive(meta, project, &body.phone_number_id, &body.to, interactive).await
}

// -- Passthrough (list / button / flow / webview) ---------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassthroughBody {
    pub phone_number_id: String,
    pub to: String,
    /// Full Meta `interactive` object assembled by the caller.
    pub interactive: Value,
}

pub async fn passthrough(
    meta: &MetaClient,
    project: &Project,
    body: PassthroughBody,
) -> Result<SendResponse> {
    post_interactive(
        meta,
        project,
        &body.phone_number_id,
        &body.to,
        body.interactive,
    )
    .await
}
