//! WhatsApp Business node — send messages via the Meta Cloud API.
//!
//! Auth: credential `whatsAppApi` carries `accessToken` (Bearer) and the
//! sender `phoneNumberId`. All operations POST a JSON envelope of the form
//! `{messaging_product: "whatsapp", ...}` to
//! `https://graph.facebook.com/v20.0/{phoneNumberId}/messages` — the
//! per-operation differences live entirely in the payload shape.
//!
//! `markAsRead` shares the same endpoint but sends a `status: "read"`
//! envelope instead of a message body.

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

const GRAPH_API: &str = "https://graph.facebook.com/v20.0";

pub struct WhatsAppNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for WhatsAppNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "whatsApp",
            "WhatsApp Business",
            "Send messages and media via the WhatsApp Business Cloud API",
            NodeCategory::Communication,
        )
        .icon("message-circle")
        .color("#25D366")
        .credentials(vec![CredentialBinding {
            name: "whatsAppApi".into(),
            display_name: "WhatsApp Cloud API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Text", "sendText"),
                    opt("Send Template", "sendTemplate"),
                    opt("Send Image", "sendImage"),
                    opt("Send Document", "sendDocument"),
                    opt("Send Audio", "sendAudio"),
                    opt("Send Video", "sendVideo"),
                    opt("Send Location", "sendLocation"),
                    opt("Send Interactive", "sendInteractive"),
                    opt("Mark As Read", "markAsRead"),
                ])
                .default(json!("sendText"))
                .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .description("Recipient phone number in E.164 format (e.g. 15551234567)")
                .show_when(
                    "operation",
                    &[
                        "sendText",
                        "sendTemplate",
                        "sendImage",
                        "sendDocument",
                        "sendAudio",
                        "sendVideo",
                        "sendLocation",
                        "sendInteractive",
                    ],
                ),
            // sendText
            NodeProperty::new("body", "Message", NodePropertyType::String)
                .description("Text body to send")
                .show_when("operation", &["sendText"]),
            // sendTemplate
            NodeProperty::new("templateName", "Template Name", NodePropertyType::String)
                .show_when("operation", &["sendTemplate"]),
            NodeProperty::new("languageCode", "Language Code", NodePropertyType::String)
                .default(json!("en_US"))
                .placeholder("en_US")
                .show_when("operation", &["sendTemplate"]),
            NodeProperty::new("components", "Components", NodePropertyType::Json)
                .description("Template components array (JSON)")
                .default(json!([]))
                .show_when("operation", &["sendTemplate"]),
            // sendImage
            NodeProperty::new("imageUrl", "Image URL", NodePropertyType::String)
                .show_when("operation", &["sendImage"]),
            // sendDocument
            NodeProperty::new("documentUrl", "Document URL", NodePropertyType::String)
                .show_when("operation", &["sendDocument"]),
            NodeProperty::new("filename", "Filename", NodePropertyType::String)
                .show_when("operation", &["sendDocument"]),
            // sendAudio
            NodeProperty::new("audioUrl", "Audio URL", NodePropertyType::String)
                .show_when("operation", &["sendAudio"]),
            // sendVideo
            NodeProperty::new("videoUrl", "Video URL", NodePropertyType::String)
                .show_when("operation", &["sendVideo"]),
            // Caption shared by image/document/video
            NodeProperty::new("caption", "Caption", NodePropertyType::String)
                .show_when("operation", &["sendImage", "sendDocument", "sendVideo"]),
            // sendLocation
            NodeProperty::new("latitude", "Latitude", NodePropertyType::Number)
                .show_when("operation", &["sendLocation"]),
            NodeProperty::new("longitude", "Longitude", NodePropertyType::Number)
                .show_when("operation", &["sendLocation"]),
            NodeProperty::new("locationName", "Location Name", NodePropertyType::String)
                .show_when("operation", &["sendLocation"]),
            NodeProperty::new("address", "Address", NodePropertyType::String)
                .show_when("operation", &["sendLocation"]),
            // sendInteractive
            NodeProperty::new("interactive", "Interactive Payload", NodePropertyType::Json)
                .description("Raw `interactive` object as defined by the WhatsApp Cloud API")
                .default(json!({}))
                .show_when("operation", &["sendInteractive"]),
            // markAsRead
            NodeProperty::new("messageId", "Message ID", NodePropertyType::String)
                .show_when("operation", &["markAsRead"]),
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
        let phone_number_id = cred
            .data
            .get("phoneNumberId")
            .ok_or_else(|| NodeError::MissingParameter("phoneNumberId".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let payload = match operation.as_str() {
            "sendText" => build_send_text(ctx, params)?,
            "sendTemplate" => build_send_template(ctx, params)?,
            "sendImage" => build_send_image(ctx, params)?,
            "sendDocument" => build_send_document(ctx, params)?,
            "sendAudio" => build_send_audio(ctx, params)?,
            "sendVideo" => build_send_video(ctx, params)?,
            "sendLocation" => build_send_location(ctx, params)?,
            "sendInteractive" => build_send_interactive(ctx, params)?,
            "markAsRead" => build_mark_as_read(ctx, params)?,
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let url = format!("{GRAPH_API}/{phone_number_id}/messages");
        let res = ctx
            .http
            .post(&url)
            .bearer_auth(&token)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;
        let status = res.status();
        let body_bytes = res.bytes().await?;
        let body_value: Value = if body_bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&body_bytes).unwrap_or_else(|_| {
                Value::String(String::from_utf8_lossy(&body_bytes).into_owned())
            })
        };

        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: describe_body(&body_value),
            });
        }

        Ok(NodeOutput::single(vec![body_value]))
    }
}

// -- payload builders ---------------------------------------------------------

fn require_str(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let s = ctx.param_str(params, key)?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(NodeError::MissingParameter(key.into()));
    }
    Ok(trimmed.to_string())
}

fn require_f64(params: &Value, key: &str) -> NodeResult<f64> {
    params
        .get(key)
        .and_then(|v| v.as_f64())
        .ok_or_else(|| NodeError::MissingParameter(key.into()))
}

fn base_envelope(to: &str) -> Map<String, Value> {
    let mut map = Map::new();
    map.insert("messaging_product".into(), Value::String("whatsapp".into()));
    map.insert("recipient_type".into(), Value::String("individual".into()));
    map.insert("to".into(), Value::String(to.to_string()));
    map
}

fn build_send_text(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let body = require_str(ctx, params, "body")?;
    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("text".into()));
    map.insert(
        "text".into(),
        json!({
            "body": body,
        }),
    );
    Ok(Value::Object(map))
}

fn build_send_template(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let template_name = require_str(ctx, params, "templateName")?;
    let language_code = ctx
        .param_str_opt(params, "languageCode")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "en_US".to_string());

    // `components` is optional. Accept either an already-parsed JSON value
    // (preferred — the UI emits Json), or a string blob that we parse here.
    let components = match params.get("components") {
        Some(Value::Array(_)) | Some(Value::Object(_)) => {
            params.get("components").cloned().unwrap()
        }
        Some(Value::String(s)) => {
            let substituted = ctx.substitute(s);
            let trimmed = substituted.trim();
            if trimmed.is_empty() {
                Value::Array(vec![])
            } else {
                serde_json::from_str(trimmed).map_err(|e| NodeError::InvalidParameter {
                    name: "components".into(),
                    reason: format!("invalid JSON: {e}"),
                })?
            }
        }
        _ => Value::Array(vec![]),
    };

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("template".into()));
    map.insert(
        "template".into(),
        json!({
            "name": template_name,
            "language": { "code": language_code },
            "components": components,
        }),
    );
    Ok(Value::Object(map))
}

fn build_send_image(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let image_url = require_str(ctx, params, "imageUrl")?;
    let caption = ctx
        .param_str_opt(params, "caption")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());

    let mut image = Map::new();
    image.insert("link".into(), Value::String(image_url));
    if let Some(c) = caption {
        image.insert("caption".into(), Value::String(c));
    }

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("image".into()));
    map.insert("image".into(), Value::Object(image));
    Ok(Value::Object(map))
}

fn build_send_document(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let document_url = require_str(ctx, params, "documentUrl")?;
    let filename = ctx
        .param_str_opt(params, "filename")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());
    let caption = ctx
        .param_str_opt(params, "caption")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());

    let mut document = Map::new();
    document.insert("link".into(), Value::String(document_url));
    if let Some(f) = filename {
        document.insert("filename".into(), Value::String(f));
    }
    if let Some(c) = caption {
        document.insert("caption".into(), Value::String(c));
    }

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("document".into()));
    map.insert("document".into(), Value::Object(document));
    Ok(Value::Object(map))
}

fn build_send_audio(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let audio_url = require_str(ctx, params, "audioUrl")?;
    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("audio".into()));
    map.insert(
        "audio".into(),
        json!({
            "link": audio_url,
        }),
    );
    Ok(Value::Object(map))
}

fn build_send_video(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let video_url = require_str(ctx, params, "videoUrl")?;
    let caption = ctx
        .param_str_opt(params, "caption")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());

    let mut video = Map::new();
    video.insert("link".into(), Value::String(video_url));
    if let Some(c) = caption {
        video.insert("caption".into(), Value::String(c));
    }

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("video".into()));
    map.insert("video".into(), Value::Object(video));
    Ok(Value::Object(map))
}

fn build_send_location(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;
    let latitude = require_f64(params, "latitude")?;
    let longitude = require_f64(params, "longitude")?;
    let name = ctx
        .param_str_opt(params, "locationName")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());
    let address = ctx
        .param_str_opt(params, "address")
        .map(|s| ctx.substitute(&s))
        .filter(|s| !s.is_empty());

    let mut location = Map::new();
    location.insert("latitude".into(), json!(latitude));
    location.insert("longitude".into(), json!(longitude));
    if let Some(n) = name {
        location.insert("name".into(), Value::String(n));
    }
    if let Some(a) = address {
        location.insert("address".into(), Value::String(a));
    }

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("location".into()));
    map.insert("location".into(), Value::Object(location));
    Ok(Value::Object(map))
}

fn build_send_interactive(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let to = require_str(ctx, params, "to")?;

    // `interactive` is fully user-supplied JSON. Accept either a parsed
    // value or a string we parse on their behalf.
    let interactive = match params.get("interactive") {
        Some(Value::Object(_)) | Some(Value::Array(_)) => {
            params.get("interactive").cloned().unwrap()
        }
        Some(Value::String(s)) => {
            let substituted = ctx.substitute(s);
            let trimmed = substituted.trim();
            if trimmed.is_empty() {
                return Err(NodeError::MissingParameter("interactive".into()));
            }
            serde_json::from_str::<Value>(trimmed).map_err(|e| NodeError::InvalidParameter {
                name: "interactive".into(),
                reason: format!("invalid JSON: {e}"),
            })?
        }
        Some(Value::Null) | None => {
            return Err(NodeError::MissingParameter("interactive".into()));
        }
        Some(other) => {
            return Err(NodeError::InvalidParameter {
                name: "interactive".into(),
                reason: format!("expected object or JSON string, got {other}"),
            });
        }
    };

    let mut map = base_envelope(&to);
    map.insert("type".into(), Value::String("interactive".into()));
    map.insert("interactive".into(), interactive);
    Ok(Value::Object(map))
}

fn build_mark_as_read(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let message_id = require_str(ctx, params, "messageId")?;
    Ok(json!({
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }))
}

/// Pull the most useful failure message out of a Graph API error body.
/// Graph typically returns `{error: {message, code, type, ...}}`.
fn describe_body(body: &Value) -> String {
    if let Some(msg) = body
        .get("error")
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
    {
        return msg.to_string();
    }
    match body {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}
