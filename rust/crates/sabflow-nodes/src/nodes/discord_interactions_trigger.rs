//! Discord Interactions trigger node — slash commands.
//!
//! Discord delivers application-command interactions (slash commands, message
//! components, modal submits) by POSTing a JSON `Interaction` object to the
//! application's "Interactions Endpoint URL". Every such request is signed
//! with the application's Ed25519 keypair and *must* be verified — sending
//! back a `200` without verification is a deal-breaker for the Discord
//! application onboarding process.
//!
//! Trigger-data shape we expect from the receiver:
//! ```json
//! {
//!   "headers": {
//!     "x-signature-ed25519":  "<hex-encoded-signature>",
//!     "x-signature-timestamp": "<unix-seconds>"
//!   },
//!   "rawBody": "<raw HTTP body before JSON parse>",
//!   "body":    { /* parsed Interaction object */ }
//! }
//! ```
//!
//! On a slash-command interaction (`type == 2`) the node emits a single
//! flattened item:
//! ```json
//! {
//!   "interactionId": "...",
//!   "name":   "weather",
//!   "options": { "city": "Bangalore" },
//!   "user":   { "id": "...", "username": "...", ... },
//!   "channel":{ "id": "...", ... },
//!   "guildId": "...",
//!   "token":   "...",        // needed to follow up via REST
//!   "signatureVerified": true,
//!   "raw":     { /* original interaction payload */ }
//! }
//! ```
//!
//! For non-command interactions (PING / message_component / modal_submit)
//! the same envelope is emitted but `name` / `options` may be empty —
//! downstream branching can use `interactionType`.
//!
//! See `discord_trigger.rs` for the same ed25519 verification stub story.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct DiscordInteractionsTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for DiscordInteractionsTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "discordInteractionsTrigger",
            "Discord Interactions Trigger",
            "Fires on Discord slash-command and component interactions (signed Ed25519 webhook)",
            NodeCategory::Trigger,
        )
        .icon("terminal")
        .color("#5865F2")
        .trigger()
        .properties(vec![
            NodeProperty::new("publicKey", "Application Public Key", NodePropertyType::String)
                .placeholder("64-char hex Ed25519 public key from the Discord application portal")
                .required()
                .description(
                    "Discord requires every interactions endpoint to verify the \
                     `X-Signature-Ed25519` header. Copy this from \
                     Application > General Information > Public Key.",
                ),
            NodeProperty::new(
                "interactionTypes",
                "Interaction Types",
                NodePropertyType::MultiOptions,
            )
            .options(vec![
                opt("Ping (type 1)", "1"),
                opt("Application Command / Slash (type 2)", "2"),
                opt("Message Component (type 3)", "3"),
                opt("Autocomplete (type 4)", "4"),
                opt("Modal Submit (type 5)", "5"),
            ])
            .default(json!(["2"]))
            .description("Which interaction types should fire this trigger."),
            NodeProperty::new(
                "commandNameFilter",
                "Command Name Filter",
                NodePropertyType::String,
            )
            .placeholder("weather")
            .description(
                "Optional. When set, slash commands whose name does not match this string \
                 are still emitted but downstream nodes can branch on `name` cheaply.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));

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

        let (signature_verified, signature_note) = if public_key.is_empty() {
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

        let interaction = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());

        let interaction_type = interaction
            .get("type")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        // Slash-command payload is at interaction.data.name + interaction.data.options[].
        let data = interaction.get("data").cloned().unwrap_or(Value::Null);
        let name = data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Discord encodes options as an array of {name, type, value} — we
        // flatten that to a {name: value} map so the downstream nodes don't
        // need to know about Discord's wire shape.
        let mut options = Map::new();
        if let Some(arr) = data.get("options").and_then(|v| v.as_array()) {
            for entry in arr {
                let opt_name = entry
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let opt_value = entry.get("value").cloned().unwrap_or(Value::Null);
                if !opt_name.is_empty() {
                    options.insert(opt_name, opt_value);
                }
            }
        }

        // User can be on either `member.user` (guild context) or `user` (DM).
        let user = interaction
            .get("member")
            .and_then(|m| m.get("user"))
            .cloned()
            .or_else(|| interaction.get("user").cloned())
            .unwrap_or(Value::Null);

        let channel = json!({
            "id": interaction.get("channel_id").cloned().unwrap_or(Value::Null),
        });

        let mut out = Map::new();
        out.insert(
            "interactionId".into(),
            interaction.get("id").cloned().unwrap_or(Value::Null),
        );
        out.insert("interactionType".into(), json!(interaction_type));
        out.insert("name".into(), Value::String(name));
        out.insert("options".into(), Value::Object(options));
        out.insert("user".into(), user);
        out.insert("channel".into(), channel);
        out.insert(
            "guildId".into(),
            interaction.get("guild_id").cloned().unwrap_or(Value::Null),
        );
        out.insert(
            "token".into(),
            interaction.get("token").cloned().unwrap_or(Value::Null),
        );
        out.insert("signatureVerified".into(), Value::Bool(signature_verified));
        out.insert("signatureNote".into(), Value::String(signature_note));
        out.insert("raw".into(), interaction);

        Ok(NodeOutput::single(vec![Value::Object(out)]))
    }
}

/// Best-effort Ed25519 verification — mirror of the stub in
/// `discord_trigger.rs`.
///
/// TODO(C.6.x): when `ed25519-dalek` is added to the workspace, replace the
/// body of this fn with a real call:
///
/// ```ignore
/// use ed25519_dalek::{Signature, VerifyingKey, Verifier};
/// let pk_bytes = hex::decode(public_key_hex).map_err(|_| ...)?;
/// let key = VerifyingKey::from_bytes(&pk_bytes.try_into().unwrap()).map_err(|_| ...)?;
/// let sig = Signature::from_slice(&hex::decode(signature_hex).map_err(|_| ...)?)?;
/// let msg = format!("{timestamp}{raw_body}");
/// key.verify(msg.as_bytes(), &sig).is_ok()
/// ```
fn verify_ed25519_stub(
    _public_key_hex: &str,
    signature_hex: &str,
    timestamp: &str,
    _raw_body: &str,
) -> (bool, String) {
    if signature_hex.len() != 128 || !signature_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return (false, "Malformed Ed25519 signature".into());
    }
    if timestamp.parse::<i64>().is_err() {
        return (false, "Malformed timestamp header".into());
    }
    (
        false,
        "ed25519-dalek not in workspace; verification stubbed".into(),
    )
}
