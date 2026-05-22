//! Zoom Trigger node (n8n-nodes-base.zoomTrigger).
//!
//! Fires when a Zoom event webhook arrives (meeting started, recording
//! completed, webinar registrant added, ...). The SabFlow webhook gateway
//! delivers the request via [`ExecutionContext::trigger_data`]:
//!
//! ```json
//! { "headers": { ... }, "body": { ... }, "raw_body": "<original utf-8 body>" }
//! ```
//!
//! Notable handling:
//!   - Zoom uses a `v0` signature header: `x-zm-signature: v0=<hex>` where
//!     the HMAC-SHA256 message is `v0:{timestamp}:{raw_body}` with timestamp
//!     supplied by `x-zm-request-timestamp`. Reference:
//!     <https://developers.zoom.us/docs/api/rest/webhook-reference/>
//!   - Zoom also requires responding to URL-validation challenges
//!     (event = `endpoint.url_validation`). For that case the trigger emits
//!     a payload containing `plain_token` + the expected
//!     `encrypted_token = hex(hmac_sha256(secret, plain_token))` so a
//!     downstream `RespondToWebhook` node can answer 200 with the
//!     `{plain_token, encrypted_token}` body Zoom expects.

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ZoomTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ZoomTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zoomTrigger",
            "Zoom Trigger",
            "Fires on Zoom meeting / webinar / recording events",
            NodeCategory::Trigger,
        )
        .icon("video")
        .color("#2D8CFF")
        .trigger()
        .properties(vec![
            NodeProperty::new("secretToken", "Secret Token", NodePropertyType::String)
                .description(
                    "Webhook Secret Token from Zoom Marketplace → Feature → \
                     Event Subscriptions. Required to verify `x-zm-signature` \
                     and to answer URL validation challenges.",
                )
                .default(Value::String("".into())),
            NodeProperty::new("event", "Event Filter", NodePropertyType::Options)
                .options(vec![
                    opt("Any", "any"),
                    opt("Meeting Started", "meeting.started"),
                    opt("Meeting Ended", "meeting.ended"),
                    opt("Meeting Participant Joined", "meeting.participant_joined"),
                    opt("Meeting Participant Left", "meeting.participant_left"),
                    opt("Recording Completed", "recording.completed"),
                    opt("Webinar Started", "webinar.started"),
                    opt("Webinar Ended", "webinar.ended"),
                    opt("Webinar Registrant Created", "webinar.registration_created"),
                ])
                .default(Value::String("any".into())),
            NodeProperty::new(
                "toleranceSeconds",
                "Timestamp Tolerance (seconds)",
                NodePropertyType::Number,
            )
            .default(json!(300))
            .description(
                "Reject the request when `x-zm-request-timestamp` is older than \
                 this many seconds (replay protection). 0 disables the check.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let envelope = ctx.trigger_data.clone().unwrap_or(json!({}));
        let headers = envelope.get("headers").cloned().unwrap_or(json!({}));
        let body = envelope.get("body").cloned().unwrap_or(json!({}));
        let raw_body = envelope
            .get("raw_body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| body.to_string());

        let secret = ctx.param_str_opt(params, "secretToken").unwrap_or_default();
        let secret_trimmed = secret.trim().to_string();
        let tolerance = ctx
            .param_f64(params, "toleranceSeconds")
            .map(|n| n as i64)
            .unwrap_or(300);

        let event_type = body
            .get("event")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // --- URL validation challenge ------------------------------------
        // Zoom sends `event = endpoint.url_validation` with
        // `payload.plainToken` once per subscription. We must respond with
        // `{ plainToken, encryptedToken }` where `encryptedToken =
        // hex(hmac_sha256(secret, plainToken))`. The HTTP gateway / a
        // RespondToWebhook node downstream is expected to send that body
        // back with a 200.
        if event_type == "endpoint.url_validation" {
            if secret_trimmed.is_empty() {
                return Err(NodeError::AuthError(
                    "Zoom URL validation requires a Secret Token".into(),
                ));
            }
            let plain_token = body
                .get("payload")
                .and_then(|p| p.get("plainToken"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| NodeError::InvalidParameter {
                    name: "payload.plainToken".into(),
                    reason: "missing in url_validation payload".into(),
                })?;
            let encrypted = hex_hmac_sha256(secret_trimmed.as_bytes(), plain_token.as_bytes())?;
            return Ok(NodeOutput::single(vec![json!({
                "source": "zoom",
                "event_type": "endpoint.url_validation",
                "url_validation": true,
                "plainToken": plain_token,
                "encryptedToken": encrypted,
                "raw": body,
            })]));
        }

        // --- Signature verification --------------------------------------
        if !secret_trimmed.is_empty() {
            let sig = header_str(&headers, "x-zm-signature")
                .ok_or_else(|| NodeError::AuthError("missing x-zm-signature header".into()))?;
            let ts = header_str(&headers, "x-zm-request-timestamp").ok_or_else(|| {
                NodeError::AuthError("missing x-zm-request-timestamp header".into())
            })?;
            verify_zoom_signature(
                secret_trimmed.as_bytes(),
                raw_body.as_bytes(),
                &ts,
                &sig,
                tolerance,
            )?;
        }

        // Optional event-type filter.
        let event_filter = ctx
            .param_str_opt(params, "event")
            .unwrap_or_else(|| "any".to_string());
        if event_filter != "any" && !event_filter.is_empty() && event_type != event_filter {
            return Ok(NodeOutput::single(vec![]));
        }

        Ok(NodeOutput::single(vec![normalize(&body, &event_type)]))
    }
}

fn header_str(headers: &Value, name: &str) -> Option<String> {
    let map = headers.as_object()?;
    for (k, v) in map {
        if k.eq_ignore_ascii_case(name) {
            return v.as_str().map(|s| s.to_string());
        }
    }
    None
}

/// Verify Zoom's `v0=<hex>` signature against `v0:{timestamp}:{raw_body}`.
fn verify_zoom_signature(
    secret: &[u8],
    raw_body: &[u8],
    timestamp: &str,
    signature_header: &str,
    tolerance_seconds: i64,
) -> NodeResult<()> {
    let received = signature_header.strip_prefix("v0=").ok_or_else(|| {
        NodeError::AuthError("malformed x-zm-signature header (expected `v0=`)".into())
    })?;

    if tolerance_seconds > 0 {
        let ts: i64 = timestamp
            .parse()
            .map_err(|_| NodeError::AuthError("invalid x-zm-request-timestamp value".into()))?;
        let now = chrono::Utc::now().timestamp();
        if (now - ts).abs() > tolerance_seconds {
            return Err(NodeError::AuthError(
                "Zoom webhook timestamp outside tolerance window".into(),
            ));
        }
    }

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret)
        .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
    mac.update(b"v0:");
    mac.update(timestamp.as_bytes());
    mac.update(b":");
    mac.update(raw_body);
    let expected = hex_encode(&mac.finalize().into_bytes());

    if constant_time_eq(received.as_bytes(), expected.as_bytes()) {
        Ok(())
    } else {
        Err(NodeError::AuthError(
            "x-zm-signature verification failed".into(),
        ))
    }
}

fn hex_hmac_sha256(secret: &[u8], message: &[u8]) -> NodeResult<String> {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret)
        .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
    mac.update(message);
    Ok(hex_encode(&mac.finalize().into_bytes()))
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Normalize a Zoom event webhook into a flat event envelope.
fn normalize(body: &Value, event_type: &str) -> Value {
    let payload = body.get("payload").cloned().unwrap_or(json!({}));
    let object = payload.get("object").cloned().unwrap_or(Value::Null);
    json!({
        "source": "zoom",
        "event_type": event_type,
        "event_ts": body.get("event_ts").cloned().unwrap_or(Value::Null),
        "account_id": payload.get("account_id").cloned().unwrap_or(Value::Null),
        "object": object,
        "operator": payload.get("operator").cloned().unwrap_or(Value::Null),
        "operator_id": payload.get("operator_id").cloned().unwrap_or(Value::Null),
        "raw": body.clone(),
    })
}
