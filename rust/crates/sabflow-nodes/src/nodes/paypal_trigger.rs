//! PayPal webhook trigger node.
//!
//! Fires when PayPal POSTs a webhook event. The upstream receiver hands us
//! a trigger envelope:
//!
//! ```json
//! {
//!   "headers": {
//!     "paypal-transmission-id":   "...",
//!     "paypal-transmission-time": "...",
//!     "paypal-transmission-sig":  "...",
//!     "paypal-cert-url":          "https://api.paypal.com/v1/notifications/certs/CERT-...",
//!     "paypal-auth-algo":         "SHA256withRSA"
//!   },
//!   "rawBody": "<raw JSON string>",
//!   "body": { /* parsed event */ }
//! }
//! ```
//!
//! ## Verification: stubbed
//!
//! PayPal's webhook signing scheme is cert-based: the verifier must (1) fetch
//! the PEM cert at `paypal-cert-url`, (2) confirm it chains to a PayPal CA,
//! (3) RSA-SHA256-verify the signature over
//! `"<transmission-id>|<transmission-time>|<webhook-id>|<crc32(rawBody)>"`.
//!
//! Step (3) needs an RSA verifier, which we can't pull in without adding a
//! crypto crate. To keep the constraint of zero new deps we expose two paths:
//!
//! 1. Trust the upstream receiver — recommended for self-hosted setups. The
//!    Next.js / API gateway in front of the engine already calls PayPal's
//!    `/v1/notifications/verify-webhook-signature` endpoint and stamps
//!    `trigger.signatureVerified = true` before forwarding. We honour that flag.
//! 2. Strict mode — when `requireVerifiedSignature = true` and the flag is
//!    absent (or false), the node errors out. This lets users opt into a
//!    fail-closed posture even though local verification is stubbed.
//!
//! Once an RSA verifier (e.g. `rsa` or `ring`) is added to the workspace,
//! `verify_paypal_signature_stub` can be promoted to a real implementation
//! without changing the node's public surface.

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

pub struct PaypalTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PaypalTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "paypalTrigger",
            "PayPal Trigger",
            "Fires on PayPal webhook events (cert-based verification — currently stubbed)",
            NodeCategory::Trigger,
        )
        .icon("dollar-sign")
        .color("#003087")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "paypalWebhook".into(),
            display_name: "PayPal Webhook ID".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description(
                    "Optional. Credential schema: { webhookId: \"...\", environment: \"live|sandbox\" }. \
                     Used by the upstream receiver when calling PayPal's verify-webhook-signature endpoint.",
                ),
            NodeProperty::new("eventType", "Event Type", NodePropertyType::Options)
                .options(vec![
                    opt("All Events", "*"),
                    opt("PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.COMPLETED"),
                    opt("PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DENIED"),
                    opt("PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REFUNDED"),
                    opt("CHECKOUT.ORDER.APPROVED", "CHECKOUT.ORDER.APPROVED"),
                    opt("CHECKOUT.ORDER.COMPLETED", "CHECKOUT.ORDER.COMPLETED"),
                    opt(
                        "BILLING.SUBSCRIPTION.CREATED",
                        "BILLING.SUBSCRIPTION.CREATED",
                    ),
                    opt(
                        "BILLING.SUBSCRIPTION.ACTIVATED",
                        "BILLING.SUBSCRIPTION.ACTIVATED",
                    ),
                    opt(
                        "BILLING.SUBSCRIPTION.CANCELLED",
                        "BILLING.SUBSCRIPTION.CANCELLED",
                    ),
                    opt("INVOICING.INVOICE.PAID", "INVOICING.INVOICE.PAID"),
                ])
                .default(json!("*"))
                .description("Event type filter applied by the upstream receiver"),
            NodeProperty::new(
                "requireVerifiedSignature",
                "Require Verified Signature",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description(
                "When true, the node rejects payloads that don't carry \
                 `signatureVerified: true` from the upstream receiver. \
                 Local cert-based verification is stubbed until an RSA verifier is wired in.",
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

        // Capture all five PayPal signature headers — useful for downstream
        // logging / replay even when local verification is stubbed.
        let sig_headers = json!({
            "transmissionId":   read_header(&trigger, "paypal-transmission-id"),
            "transmissionTime": read_header(&trigger, "paypal-transmission-time"),
            "transmissionSig":  read_header(&trigger, "paypal-transmission-sig"),
            "certUrl":          read_header(&trigger, "paypal-cert-url"),
            "authAlgo":         read_header(&trigger, "paypal-auth-algo"),
        });

        // Stubbed verification — currently honours an upstream `signatureVerified` flag.
        let verified = trigger
            .get("signatureVerified")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let require_verified = ctx.param_bool(params, "requireVerifiedSignature", false);
        if require_verified && !verified {
            return Err(NodeError::AuthError(
                "PayPal webhook signature was not verified by the upstream receiver \
                 (requireVerifiedSignature=true)"
                    .into(),
            ));
        }

        // If a credential is bound, surface its identifiers so downstream nodes
        // (or audit hooks) can correlate the call with a configured webhook.
        let webhook_id = ctx
            .param_str_opt(params, "credentialId")
            .filter(|s| !s.trim().is_empty())
            .and_then(|id| ctx.credentials.get(&id).cloned())
            .and_then(|cred| cred.data.get("webhookId").cloned());

        let payload = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());

        // Wrap the original body with verification metadata so downstream nodes
        // can branch on `$json._meta.signatureVerified`.
        let item = json!({
            "_meta": {
                "signatureVerified": verified,
                "webhookId": webhook_id,
                "headers": sig_headers,
            },
            "event": payload,
        });

        Ok(NodeOutput::single(vec![item]))
    }
}

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

/// Placeholder for the eventual RSA-SHA256 verification. The signature input
/// is `"<transmissionId>|<transmissionTime>|<webhookId>|<crc32(rawBody)>"`
/// signed against the PEM at `certUrl`. Keep this signature stable so callers
/// don't churn once it's implemented.
#[allow(dead_code)]
fn verify_paypal_signature_stub(
    _transmission_id: &str,
    _transmission_time: &str,
    _transmission_sig: &str,
    _cert_url: &str,
    _auth_algo: &str,
    _webhook_id: &str,
    _raw_body: &str,
) -> NodeResult<()> {
    // TODO: when an RSA verifier crate is whitelisted, implement:
    //   1. Fetch the PEM cert from `cert_url` (validate scheme=https and host
    //      ends with `paypal.com`).
    //   2. Verify the chain against PayPal's root CA bundle.
    //   3. Compute crc32(raw_body) and rebuild the signed payload:
    //        format!("{transmission_id}|{transmission_time}|{webhook_id}|{crc32}")
    //   4. RSA-SHA256-verify `transmission_sig` (base64) against the payload
    //      with the cert's public key.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_header_is_case_insensitive() {
        let trigger = json!({
            "headers": { "Paypal-Transmission-Id": "abc-123" }
        });
        assert_eq!(
            read_header(&trigger, "paypal-transmission-id"),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn read_header_missing_returns_none() {
        let trigger = json!({ "headers": {} });
        assert_eq!(read_header(&trigger, "paypal-cert-url"), None);
    }

    #[test]
    fn stub_returns_ok() {
        assert!(
            verify_paypal_signature_stub("a", "b", "c", "d", "SHA256withRSA", "WH-X", "{}").is_ok()
        );
    }
}
