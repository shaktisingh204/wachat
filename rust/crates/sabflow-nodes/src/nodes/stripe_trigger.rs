//! Stripe webhook trigger node.
//!
//! Fires a SabFlow when Stripe POSTs a webhook event. The HTTP receiver lives
//! upstream of the engine; when it dispatches, the request envelope is placed
//! on `ExecutionContext::trigger_data` with the shape:
//!
//! ```json
//! {
//!   "headers": { "stripe-signature": "t=...,v1=..." },
//!   "rawBody": "<raw JSON string>",
//!   "body": { /* parsed event */ }
//! }
//! ```
//!
//! When a `stripeWebhook` credential with a `webhookSecret` field is bound,
//! we verify the `Stripe-Signature` header via HMAC-SHA256 over
//! `"<timestamp>.<rawBody>"`. If verification fails the node errors out so
//! downstream nodes never see an unauthenticated payload.
//!
//! Stripe sig spec: <https://stripe.com/docs/webhooks/signatures>

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct StripeTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for StripeTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "stripeTrigger",
            "Stripe Trigger",
            "Fires on Stripe webhook events (HMAC-SHA256 signed)",
            NodeCategory::Trigger,
        )
        .icon("credit-card")
        .color("#635BFF")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "stripeWebhook".into(),
            display_name: "Stripe Webhook Signing Secret".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description(
                    "Optional. When set, the node verifies the Stripe-Signature header. \
                     Credential schema: { webhookSecret: \"whsec_...\" }.",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::Options)
                .options(vec![
                    opt("All Events", "*"),
                    opt("charge.succeeded", "charge.succeeded"),
                    opt("charge.failed", "charge.failed"),
                    opt("checkout.session.completed", "checkout.session.completed"),
                    opt("customer.created", "customer.created"),
                    opt("customer.updated", "customer.updated"),
                    opt("customer.deleted", "customer.deleted"),
                    opt(
                        "customer.subscription.created",
                        "customer.subscription.created",
                    ),
                    opt(
                        "customer.subscription.updated",
                        "customer.subscription.updated",
                    ),
                    opt(
                        "customer.subscription.deleted",
                        "customer.subscription.deleted",
                    ),
                    opt("invoice.paid", "invoice.paid"),
                    opt("invoice.payment_failed", "invoice.payment_failed"),
                    opt("payment_intent.succeeded", "payment_intent.succeeded"),
                    opt(
                        "payment_intent.payment_failed",
                        "payment_intent.payment_failed",
                    ),
                ])
                .default(json!("*"))
                .description("Event type filter applied by the upstream receiver"),
            NodeProperty::new(
                "toleranceSeconds",
                "Signature Tolerance (seconds)",
                NodePropertyType::Number,
            )
            .default(json!(300))
            .description(
                "Reject signatures whose timestamp is older than this. Stripe's default is 5 min.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or(json!({}));

        // Verify signature if a credential is bound.
        if let Some(cred_id) = ctx.param_str_opt(params, "credentialId") {
            if !cred_id.trim().is_empty() {
                let cred = ctx.credential(&cred_id)?;
                let secret = cred
                    .data
                    .get("webhookSecret")
                    .cloned()
                    .ok_or_else(|| NodeError::MissingParameter("webhookSecret".into()))?;
                let signature = read_header(&trigger, "stripe-signature").ok_or_else(|| {
                    NodeError::AuthError("missing Stripe-Signature header".into())
                })?;
                let raw_body = raw_body(&trigger).ok_or_else(|| {
                    NodeError::AuthError(
                        "missing rawBody on trigger payload — required for signature check".into(),
                    )
                })?;
                let tolerance = ctx
                    .param_f64(params, "toleranceSeconds")
                    .map(|n| n.trunc() as i64)
                    .unwrap_or(300);
                verify_stripe_signature(&signature, &raw_body, &secret, tolerance)?;
            }
        }

        // Surface the parsed event body (or full trigger envelope if absent).
        let payload = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());
        Ok(NodeOutput::single(vec![payload]))
    }
}

/// Pull a header value (case-insensitive) out of the trigger envelope.
fn read_header(trigger: &Value, name: &str) -> Option<String> {
    let headers = trigger.get("headers")?.as_object()?;
    let lower = name.to_ascii_lowercase();
    for (k, v) in headers.iter() {
        if k.to_ascii_lowercase() == lower {
            return v.as_str().map(|s| s.to_string());
        }
    }
    None
}

/// The raw body string is required for HMAC; reading the parsed JSON would
/// drop key ordering and whitespace.
fn raw_body(trigger: &Value) -> Option<String> {
    trigger
        .get("rawBody")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Parse Stripe's `t=...,v1=...,v1=...` header and verify at least one v1 hex
/// digest matches HMAC-SHA256(secret, "<t>.<body>"). Constant-time comparison.
fn verify_stripe_signature(
    header: &str,
    raw_body: &str,
    secret: &str,
    tolerance_seconds: i64,
) -> NodeResult<()> {
    let mut timestamp: Option<&str> = None;
    let mut v1_sigs: Vec<&str> = Vec::new();
    for pair in header.split(',') {
        let mut it = pair.splitn(2, '=');
        match (it.next(), it.next()) {
            (Some("t"), Some(v)) => timestamp = Some(v.trim()),
            (Some("v1"), Some(v)) => v1_sigs.push(v.trim()),
            _ => {}
        }
    }

    let ts = timestamp.ok_or_else(|| {
        NodeError::AuthError("Stripe-Signature header missing `t=` timestamp".into())
    })?;
    if v1_sigs.is_empty() {
        return Err(NodeError::AuthError(
            "Stripe-Signature header missing `v1=` digest".into(),
        ));
    }

    // Tolerance check — Stripe sends Unix seconds.
    if let Ok(ts_num) = ts.parse::<i64>() {
        let now = chrono::Utc::now().timestamp();
        if (now - ts_num).abs() > tolerance_seconds {
            return Err(NodeError::AuthError(format!(
                "Stripe webhook timestamp outside tolerance ({tolerance_seconds}s)"
            )));
        }
    }

    let signed_payload = format!("{ts}.{raw_body}");
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).map_err(|e| {
        NodeError::InvalidParameter {
            name: "webhookSecret".into(),
            reason: format!("invalid HMAC key: {e}"),
        }
    })?;
    mac.update(signed_payload.as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_hex = hex_lower(&expected);

    for candidate in v1_sigs {
        if constant_time_eq_str(candidate, &expected_hex) {
            return Ok(());
        }
    }
    Err(NodeError::AuthError(
        "Stripe-Signature v1 digest did not match HMAC-SHA256(secret, t.body)".into(),
    ))
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// Length-checked constant-time string compare to keep signature checks from
/// leaking timing info.
fn constant_time_eq_str(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    if ab.len() != bb.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in ab.iter().zip(bb.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sign(secret: &str, ts: i64, body: &str) -> String {
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(format!("{ts}.{body}").as_bytes());
        hex_lower(&mac.finalize().into_bytes())
    }

    #[test]
    fn verifies_valid_signature() {
        let secret = "whsec_test";
        let body = r#"{"id":"evt_1"}"#;
        let ts = chrono::Utc::now().timestamp();
        let sig = sign(secret, ts, body);
        let header = format!("t={ts},v1={sig}");
        assert!(verify_stripe_signature(&header, body, secret, 300).is_ok());
    }

    #[test]
    fn rejects_bad_signature() {
        let secret = "whsec_test";
        let body = r#"{"id":"evt_1"}"#;
        let ts = chrono::Utc::now().timestamp();
        let header = format!("t={ts},v1=deadbeef");
        assert!(verify_stripe_signature(&header, body, secret, 300).is_err());
    }

    #[test]
    fn rejects_stale_timestamp() {
        let secret = "whsec_test";
        let body = r#"{"id":"evt_1"}"#;
        let ts = chrono::Utc::now().timestamp() - 10_000;
        let sig = sign(secret, ts, body);
        let header = format!("t={ts},v1={sig}");
        assert!(verify_stripe_signature(&header, body, secret, 300).is_err());
    }
}
