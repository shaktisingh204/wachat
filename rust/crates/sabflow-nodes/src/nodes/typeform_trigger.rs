//! Typeform Trigger node (n8n-nodes-base.typeformTrigger).
//!
//! Fires a flow whenever a Typeform form receives a new response. The actual
//! webhook receiver lives outside the engine (the SabFlow webhook gateway).
//! When a request arrives the gateway hands the raw envelope to the engine
//! via [`ExecutionContext::trigger_data`] using the shape:
//!
//! ```json
//! { "headers": { ... }, "body": { ... }, "raw_body": "<original utf-8 body>" }
//! ```
//!
//! This node:
//!   1. Verifies the `Typeform-Signature` header
//!      (`sha256=<base64(hmac_sha256(secret, raw_body))>`) against the
//!      `signingSecret` parameter.
//!   2. Normalizes the Typeform response payload into a flat event envelope.
//!   3. Emits a single output item so downstream nodes can read the
//!      submission.
//!
//! Reference: <https://www.typeform.com/developers/webhooks/secure-your-webhooks/>

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use hmac::{Hmac, Mac};
use serde_json::{Map, Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct TypeformTriggerNode;

#[async_trait]
impl Node for TypeformTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "typeformTrigger",
            "Typeform Trigger",
            "Fires when a Typeform form receives a new response",
            NodeCategory::Trigger,
        )
        .icon("clipboard-list")
        .color("#262627")
        .trigger()
        .properties(vec![
            NodeProperty::new("signingSecret", "Signing Secret", NodePropertyType::String)
                .description(
                    "Secret used to sign the webhook (Typeform connect → \
                     webhooks → secret). When empty, signature verification \
                     is skipped (NOT recommended).",
                )
                .default(Value::String("".into())),
            NodeProperty::new("formId", "Form ID Filter", NodePropertyType::String)
                .description(
                    "Optional — when set, the trigger only emits when the \
                     incoming payload's `form_response.form_id` matches.",
                )
                .default(Value::String("".into())),
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

        let secret = ctx
            .param_str_opt(params, "signingSecret")
            .unwrap_or_default();
        let secret_trimmed = secret.trim();
        if !secret_trimmed.is_empty() {
            let header = header_str(&headers, "typeform-signature").ok_or_else(|| {
                NodeError::AuthError("missing Typeform-Signature header".into())
            })?;
            verify_typeform_signature(secret_trimmed, raw_body.as_bytes(), &header)?;
        }

        // Optional form-id filter.
        let form_filter = ctx
            .param_str_opt(params, "formId")
            .unwrap_or_default()
            .trim()
            .to_string();
        let form_response = body.get("form_response").cloned().unwrap_or(json!({}));
        if !form_filter.is_empty() {
            let incoming = form_response
                .get("form_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if incoming != form_filter {
                return Ok(NodeOutput::single(vec![]));
            }
        }

        Ok(NodeOutput::single(vec![normalize(&body, &form_response)]))
    }
}

/// Pull a case-insensitive header value out of the headers JSON map.
fn header_str(headers: &Value, name: &str) -> Option<String> {
    let map = headers.as_object()?;
    for (k, v) in map {
        if k.eq_ignore_ascii_case(name) {
            return v.as_str().map(|s| s.to_string());
        }
    }
    None
}

/// Verify a Typeform `sha256=<base64>` signature against `raw_body`.
fn verify_typeform_signature(secret: &str, raw_body: &[u8], header: &str) -> NodeResult<()> {
    let received = header
        .strip_prefix("sha256=")
        .ok_or_else(|| NodeError::AuthError("malformed Typeform-Signature header".into()))?;

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
    mac.update(raw_body);
    let expected = general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    if constant_time_eq(received.as_bytes(), expected.as_bytes()) {
        Ok(())
    } else {
        Err(NodeError::AuthError(
            "Typeform-Signature verification failed".into(),
        ))
    }
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

/// Normalize a Typeform webhook into a flat event envelope.
fn normalize(body: &Value, form_response: &Value) -> Value {
    let mut answers_map = Map::new();
    if let Some(answers) = form_response.get("answers").and_then(|v| v.as_array()) {
        for ans in answers {
            let key = ans
                .get("field")
                .and_then(|f| f.get("ref"))
                .and_then(|v| v.as_str())
                .or_else(|| ans.get("field").and_then(|f| f.get("id")).and_then(|v| v.as_str()))
                .unwrap_or("");
            if key.is_empty() {
                continue;
            }
            let value = extract_answer_value(ans);
            answers_map.insert(key.to_string(), value);
        }
    }

    json!({
        "source": "typeform",
        "event_type": body.get("event_type").cloned().unwrap_or(json!("form_response")),
        "event_id": body.get("event_id").cloned().unwrap_or(Value::Null),
        "form_id": form_response.get("form_id").cloned().unwrap_or(Value::Null),
        "submission_id": form_response.get("token").cloned().unwrap_or(Value::Null),
        "submitted_at": form_response.get("submitted_at").cloned().unwrap_or(Value::Null),
        "landed_at": form_response.get("landed_at").cloned().unwrap_or(Value::Null),
        "answers": Value::Object(answers_map),
        "hidden": form_response.get("hidden").cloned().unwrap_or(json!({})),
        "raw": body.clone(),
    })
}

/// Typeform's per-answer payload tags its primitive value by `type`.
fn extract_answer_value(ans: &Value) -> Value {
    let ty = ans.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if ty.is_empty() {
        return ans.clone();
    }
    ans.get(ty).cloned().unwrap_or(Value::Null)
}
