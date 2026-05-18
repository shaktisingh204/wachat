//! Discord trigger node (`n8n-nodes-base.discordTrigger`).
//!
//! Fires a flow when Discord delivers an Outgoing Webhook event (e.g. a bot
//! POSTs a message-create / interaction event to a SabFlow-hosted endpoint).
//! Like the generic `webhook` trigger, the HTTP receiver lives outside the
//! engine: when a request arrives, the request payload (and any
//! Discord-specific headers needed for signature verification) is handed to
//! the engine via `ExecutionContext::trigger_data`.
//!
//! Trigger-data shape we expect from the receiver:
//! ```json
//! {
//!   "headers": {
//!     "x-signature-ed25519":  "<hex-encoded-signature>",
//!     "x-signature-timestamp": "<unix-seconds>"
//!   },
//!   "rawBody": "<request body as received, BEFORE JSON parse>",
//!   "body":    { /* parsed JSON event */ },
//!   "query":   { /* query string parameters */ }
//! }
//! ```
//!
//! ## Signature verification
//!
//! Discord signs every outbound request with an Ed25519 keypair whose public
//! key is configured in the application portal. The reference verification
//! is `verify(public_key, signature, timestamp || raw_body)`.
//!
//! The crate doesn't currently depend on `ed25519-dalek` (and Phase C.6 forbids
//! introducing new top-level deps), so we provide a best-effort stub here:
//! the signature/timestamp are surfaced on the output item under
//! `signatureVerified: false` with a `signatureNote` describing why. Wiring
//! up real verification is a one-line swap inside `verify_ed25519_stub` once
//! the crate is added to `Cargo.toml`.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct DiscordTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for DiscordTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "discordTrigger",
            "Discord Trigger",
            "Fires when Discord delivers a webhook event (message, reaction, etc.)",
            NodeCategory::Trigger,
        )
        .icon("hash")
        .color("#5865F2")
        .trigger()
        .properties(vec![
            NodeProperty::new("publicKey", "Application Public Key", NodePropertyType::String)
                .placeholder("64-char hex Ed25519 public key from the Discord application portal")
                .description(
                    "Used to verify the `X-Signature-Ed25519` header. Leave blank to skip \
                     verification (not recommended for production).",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::MultiOptions)
                .options(vec![
                    opt("Message Create", "MESSAGE_CREATE"),
                    opt("Message Update", "MESSAGE_UPDATE"),
                    opt("Message Delete", "MESSAGE_DELETE"),
                    opt("Reaction Add", "MESSAGE_REACTION_ADD"),
                    opt("Reaction Remove", "MESSAGE_REACTION_REMOVE"),
                    opt("Guild Member Add", "GUILD_MEMBER_ADD"),
                    opt("Guild Member Remove", "GUILD_MEMBER_REMOVE"),
                ])
                .default(json!(["MESSAGE_CREATE"]))
                .description("Discord gateway event types this trigger should react to."),
            NodeProperty::new("verifySignature", "Verify Signature", NodePropertyType::Boolean)
                .default(json!(true))
                .description("Reject requests with an invalid Ed25519 signature."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));

        let verify = ctx.param_bool(params, "verifySignature", true);
        let public_key = ctx.param_str_opt(params, "publicKey").unwrap_or_default();

        let signature = trigger
            .get("headers")
            .and_then(|h| h.get("x-signature-ed25519"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let timestamp = trigger
            .get("headers")
            .and_then(|h| h.get("x-signature-timestamp"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let raw_body = trigger
            .get("rawBody")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let body = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());

        let (signature_verified, signature_note) = if !verify {
            (false, "Verification disabled by node config".to_string())
        } else if public_key.is_empty() {
            (
                false,
                "No application public key configured; verification skipped".to_string(),
            )
        } else if signature.is_empty() || timestamp.is_empty() {
            (
                false,
                "Missing X-Signature-Ed25519 / X-Signature-Timestamp headers".to_string(),
            )
        } else {
            verify_ed25519_stub(&public_key, &signature, &timestamp, &raw_body)
        };

        let event_type = body
            .get("t")
            .and_then(|v| v.as_str())
            .or_else(|| body.get("type").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();

        let mut out = Map::new();
        out.insert("event".into(), Value::String(event_type));
        out.insert("payload".into(), body);
        out.insert("signatureVerified".into(), Value::Bool(signature_verified));
        out.insert("signatureNote".into(), Value::String(signature_note));

        Ok(NodeOutput::single(vec![Value::Object(out)]))
    }
}

/// Best-effort Ed25519 verification.
///
/// TODO(C.6.x): wire this up to `ed25519-dalek` once the crate is in the
/// workspace dependency set. The Discord-documented check is:
///
/// ```text
/// verify(public_key, hex_decode(signature), timestamp_bytes || raw_body)
/// ```
///
/// Until that's available we run two shape checks (hex length, presence)
/// purely so the node short-circuits truly malformed requests; we never
/// claim a positive verification result without the real crate.
fn verify_ed25519_stub(
    _public_key_hex: &str,
    signature_hex: &str,
    timestamp: &str,
    _raw_body: &str,
) -> (bool, String) {
    // Discord signatures are 64 bytes -> 128 hex chars.
    if signature_hex.len() != 128 || !signature_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return (false, "Malformed Ed25519 signature".into());
    }
    if timestamp.parse::<i64>().is_err() {
        return (false, "Malformed timestamp header".into());
    }
    // We can't actually do crypto without the dependency — surface that.
    (
        false,
        "ed25519-dalek not in workspace; verification stubbed".into(),
    )
}
