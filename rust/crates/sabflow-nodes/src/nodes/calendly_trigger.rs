//! Calendly Trigger node (n8n-nodes-base.calendlyTrigger).
//!
//! Fires when Calendly delivers a webhook (`invitee.created`,
//! `invitee.canceled`, `routing_form_submission.created`, ...). The SabFlow
//! webhook gateway hands the engine an envelope with shape:
//!
//! ```json
//! { "headers": { ... }, "body": { ... }, "raw_body": "<original utf-8 body>" }
//! ```
//!
//! This node:
//!   1. Verifies the `Calendly-Webhook-Signature` header — Calendly uses
//!      `t=<unix_seconds>,v1=<hex(hmac_sha256(secret, "{t}.{raw_body}"))>`.
//!   2. Normalizes the Calendly v2 webhook payload into a flat event
//!      envelope suited for downstream automation (CRM upserts, etc.).
//!
//! Reference: <https://developer.calendly.com/api-docs/webhooks-overview>

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CalendlyTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CalendlyTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "calendlyTrigger",
            "Calendly Trigger",
            "Fires when a Calendly event is scheduled, canceled, or rescheduled",
            NodeCategory::Trigger,
        )
        .icon("calendar")
        .color("#006BFF")
        .trigger()
        .properties(vec![
            NodeProperty::new("signingKey", "Signing Key", NodePropertyType::String)
                .description(
                    "Secret returned when the Calendly subscription was created. \
                     When empty, signature verification is skipped (NOT \
                     recommended).",
                )
                .default(Value::String("".into())),
            NodeProperty::new("event", "Event Filter", NodePropertyType::Options)
                .options(vec![
                    opt("Any", "any"),
                    opt("Invitee Created", "invitee.created"),
                    opt("Invitee Canceled", "invitee.canceled"),
                    opt("Invitee No Show Created", "invitee_no_show.created"),
                    opt("Invitee No Show Deleted", "invitee_no_show.deleted"),
                    opt("Routing Form Submission", "routing_form_submission.created"),
                ])
                .default(Value::String("any".into())),
            NodeProperty::new(
                "toleranceSeconds",
                "Timestamp Tolerance (seconds)",
                NodePropertyType::Number,
            )
            .default(json!(300))
            .description(
                "Reject the request when the signed timestamp is older than \
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

        let signing_key = ctx.param_str_opt(params, "signingKey").unwrap_or_default();
        let tolerance = ctx
            .param_f64(params, "toleranceSeconds")
            .map(|n| n as i64)
            .unwrap_or(300);

        let key_trimmed = signing_key.trim();
        if !key_trimmed.is_empty() {
            let header = header_str(&headers, "calendly-webhook-signature").ok_or_else(|| {
                NodeError::AuthError("missing Calendly-Webhook-Signature header".into())
            })?;
            verify_calendly_signature(key_trimmed, raw_body.as_bytes(), &header, tolerance)?;
        }

        // Optional event-type filter.
        let event_filter = ctx
            .param_str_opt(params, "event")
            .unwrap_or_else(|| "any".to_string());
        let event_type = body
            .get("event")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
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

/// Verify Calendly's `t=...,v1=...` signature header.
fn verify_calendly_signature(
    secret: &str,
    raw_body: &[u8],
    header: &str,
    tolerance_seconds: i64,
) -> NodeResult<()> {
    let mut t: Option<&str> = None;
    let mut v1: Option<&str> = None;
    for part in header.split(',') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix("t=") {
            t = Some(rest);
        } else if let Some(rest) = part.strip_prefix("v1=") {
            v1 = Some(rest);
        }
    }
    let t = t.ok_or_else(|| {
        NodeError::AuthError("missing `t=` in Calendly-Webhook-Signature".into())
    })?;
    let v1 = v1.ok_or_else(|| {
        NodeError::AuthError("missing `v1=` in Calendly-Webhook-Signature".into())
    })?;

    // Optional replay protection.
    if tolerance_seconds > 0 {
        let ts: i64 = t.parse().map_err(|_| {
            NodeError::AuthError("invalid timestamp in Calendly-Webhook-Signature".into())
        })?;
        let now = chrono::Utc::now().timestamp();
        if (now - ts).abs() > tolerance_seconds {
            return Err(NodeError::AuthError(
                "Calendly webhook timestamp outside tolerance window".into(),
            ));
        }
    }

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
    mac.update(t.as_bytes());
    mac.update(b".");
    mac.update(raw_body);
    let expected = hex_encode(&mac.finalize().into_bytes());

    if constant_time_eq(v1.as_bytes(), expected.as_bytes()) {
        Ok(())
    } else {
        Err(NodeError::AuthError(
            "Calendly-Webhook-Signature verification failed".into(),
        ))
    }
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

/// Normalize a Calendly v2 webhook into a flat event envelope.
fn normalize(body: &Value, event_type: &str) -> Value {
    let payload = body.get("payload").cloned().unwrap_or(json!({}));
    let scheduled_event = payload
        .get("scheduled_event")
        .cloned()
        .unwrap_or(Value::Null);

    json!({
        "source": "calendly",
        "event_type": event_type,
        "created_at": body.get("created_at").cloned().unwrap_or(Value::Null),
        "invitee": {
            "uri": payload.get("uri").cloned().unwrap_or(Value::Null),
            "name": payload.get("name").cloned().unwrap_or(Value::Null),
            "email": payload.get("email").cloned().unwrap_or(Value::Null),
            "status": payload.get("status").cloned().unwrap_or(Value::Null),
            "timezone": payload.get("timezone").cloned().unwrap_or(Value::Null),
            "questions_and_answers": payload
                .get("questions_and_answers")
                .cloned()
                .unwrap_or(json!([])),
            "cancel_url": payload.get("cancel_url").cloned().unwrap_or(Value::Null),
            "reschedule_url": payload.get("reschedule_url").cloned().unwrap_or(Value::Null),
        },
        "scheduled_event": scheduled_event,
        "tracking": payload.get("tracking").cloned().unwrap_or(Value::Null),
        "raw": body.clone(),
    })
}
