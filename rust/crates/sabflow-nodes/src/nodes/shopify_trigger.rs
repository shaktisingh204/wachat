//! Shopify webhook trigger node.
//!
//! Fires when Shopify POSTs a webhook (orders/create, products/update, …).
//! The upstream receiver hands us a trigger envelope:
//!
//! ```json
//! {
//!   "headers": {
//!     "x-shopify-hmac-sha256": "<base64>",
//!     "x-shopify-topic": "orders/create",
//!     "x-shopify-shop-domain": "mystore.myshopify.com"
//!   },
//!   "rawBody": "<raw JSON string>",
//!   "body": { /* parsed payload */ }
//! }
//! ```
//!
//! When a `shopifyWebhook` credential with a `sharedSecret` field is bound,
//! we verify the `X-Shopify-Hmac-Sha256` header by computing
//! `base64(HMAC-SHA256(sharedSecret, rawBody))` and comparing in constant time.
//!
//! Shopify HMAC spec: <https://shopify.dev/docs/apps/webhooks/configuration/https#verify-a-webhook>

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
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

pub struct ShopifyTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ShopifyTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "shopifyTrigger",
            "Shopify Trigger",
            "Fires on Shopify webhook events (HMAC-SHA256 base64 signed)",
            NodeCategory::Trigger,
        )
        .icon("shopping-bag")
        .color("#96BF48")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "shopifyWebhook".into(),
            display_name: "Shopify Webhook Shared Secret".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description(
                    "Optional. When set, the node verifies the X-Shopify-Hmac-Sha256 header. \
                     Credential schema: { sharedSecret: \"shpss_...\" }.",
                ),
            NodeProperty::new("topic", "Topic", NodePropertyType::Options)
                .options(vec![
                    opt("All Topics", "*"),
                    opt("orders/create", "orders/create"),
                    opt("orders/updated", "orders/updated"),
                    opt("orders/paid", "orders/paid"),
                    opt("orders/cancelled", "orders/cancelled"),
                    opt("orders/fulfilled", "orders/fulfilled"),
                    opt("products/create", "products/create"),
                    opt("products/update", "products/update"),
                    opt("products/delete", "products/delete"),
                    opt("customers/create", "customers/create"),
                    opt("customers/update", "customers/update"),
                    opt("customers/delete", "customers/delete"),
                    opt("carts/create", "carts/create"),
                    opt("carts/update", "carts/update"),
                    opt("app/uninstalled", "app/uninstalled"),
                ])
                .default(json!("*"))
                .description("Webhook topic filter applied by the upstream receiver"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or(json!({}));

        if let Some(cred_id) = ctx.param_str_opt(params, "credentialId") {
            if !cred_id.trim().is_empty() {
                let cred = ctx.credential(&cred_id)?;
                let secret = cred
                    .data
                    .get("sharedSecret")
                    .cloned()
                    .ok_or_else(|| NodeError::MissingParameter("sharedSecret".into()))?;
                let signature =
                    read_header(&trigger, "x-shopify-hmac-sha256").ok_or_else(|| {
                        NodeError::AuthError("missing X-Shopify-Hmac-Sha256 header".into())
                    })?;
                let raw_body = raw_body(&trigger).ok_or_else(|| {
                    NodeError::AuthError(
                        "missing rawBody on trigger payload — required for signature check".into(),
                    )
                })?;
                verify_shopify_signature(&signature, &raw_body, &secret)?;
            }
        }

        let payload = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());
        Ok(NodeOutput::single(vec![payload]))
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

fn raw_body(trigger: &Value) -> Option<String> {
    trigger
        .get("rawBody")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Verify `base64(HMAC-SHA256(sharedSecret, rawBody))` matches the header.
fn verify_shopify_signature(header: &str, raw_body: &str, secret: &str) -> NodeResult<()> {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).map_err(|e| {
        NodeError::InvalidParameter {
            name: "sharedSecret".into(),
            reason: format!("invalid HMAC key: {e}"),
        }
    })?;
    mac.update(raw_body.as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_b64 = general_purpose::STANDARD.encode(expected);

    if constant_time_eq_str(header.trim(), &expected_b64) {
        Ok(())
    } else {
        Err(NodeError::AuthError(
            "X-Shopify-Hmac-Sha256 digest did not match HMAC-SHA256(secret, body)".into(),
        ))
    }
}

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

    fn sign(secret: &str, body: &str) -> String {
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body.as_bytes());
        general_purpose::STANDARD.encode(mac.finalize().into_bytes())
    }

    #[test]
    fn verifies_valid_signature() {
        let secret = "shpss_secret";
        let body = r#"{"id":12345}"#;
        let sig = sign(secret, body);
        assert!(verify_shopify_signature(&sig, body, secret).is_ok());
    }

    #[test]
    fn rejects_bad_signature() {
        let secret = "shpss_secret";
        let body = r#"{"id":12345}"#;
        assert!(verify_shopify_signature("not-a-real-hmac", body, secret).is_err());
    }

    #[test]
    fn rejects_wrong_secret() {
        let body = r#"{"id":12345}"#;
        let sig = sign("right_secret", body);
        assert!(verify_shopify_signature(&sig, body, "wrong_secret").is_err());
    }
}
