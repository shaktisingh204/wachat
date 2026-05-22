//! Slack slash command + interactivity trigger.
//!
//! n8n type id: `n8n-nodes-base.slackSlashCommandTrigger`.
//!
//! Slack POSTs an `application/x-www-form-urlencoded` body to the registered
//! Request URL whenever a user types a slash command (e.g. `/deploy prod`) or
//! invokes an interactive payload (button click, view submission, …). The
//! HTTP receiver decodes that body to JSON and parks it on
//! [`ExecutionContext::trigger_data`].
//!
//! For slash commands, this node emits the canonical n8n-compatible shape:
//!
//! ```json
//! {
//!   "command": "/deploy",
//!   "text": "prod us-east-1",
//!   "user_id": "U01234567",
//!   "user_name": "alice",
//!   "channel_id": "C01234567",
//!   "channel_name": "ops",
//!   "team_id": "T01234567",
//!   "team_domain": "acme",
//!   "response_url": "https://hooks.slack.com/commands/T0.../1234/abc",
//!   "trigger_id": "1234.5678.abcdef",
//!   "api_app_id": "A01234567"
//! }
//! ```
//!
//! For interactivity (`payload=…` form field containing JSON), the inner
//! payload is parsed and emitted verbatim under the same key — the n8n field
//! mapping naturally falls through (`user.id`, `actions`, `response_url`, …).

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::NodeResult,
    node::Node,
};

use super::slack_signature::{SignatureMeta, verify_slack_signature};

pub struct SlackSlashCommandTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SlackSlashCommandTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "slackSlashCommandTrigger",
            "Slack Slash Command / Interactivity",
            "Starts a flow on a Slack slash command or interactive payload",
            NodeCategory::Trigger,
        )
        .icon("terminal")
        .color("#4A154B")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "slackApi".into(),
            display_name: "Slack API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("mode", "Source", NodePropertyType::Options)
                .options(vec![
                    opt("Slash Command", "slashCommand"),
                    opt(
                        "Interactivity (block actions / view submit)",
                        "interactivity",
                    ),
                    opt("Any (auto-detect)", "any"),
                ])
                .default(json!("any"))
                .description(
                    "Slack uses the same Request URL for both surfaces. Set this if \
                     you want the flow to only fire for one of them.",
                ),
            NodeProperty::new("commandFilter", "Command Name", NodePropertyType::String)
                .placeholder("/deploy")
                .show_when("mode", &["slashCommand", "any"])
                .description(
                    "If set, only flows matching this exact command name fire (include the slash).",
                ),
            NodeProperty::new(
                "verifySignature",
                "Verify Signature",
                NodePropertyType::Boolean,
            )
            .default(json!(true))
            .description("Re-verify the X-Slack-Signature header on each delivery."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let raw = ctx.trigger_data.clone().unwrap_or(json!({}));

        if ctx.param_bool(params, "verifySignature", true) {
            let cred_id = ctx
                .param_str_opt(params, "credentialId")
                .unwrap_or_default();
            if !cred_id.is_empty() {
                if let Ok(cred) = ctx.credential(&cred_id) {
                    if let Some(signing_secret) = cred.data.get("signingSecret") {
                        if let Some(meta) = SignatureMeta::from_trigger(&raw) {
                            verify_slack_signature(signing_secret, &meta)?;
                        }
                    }
                }
            }
        }

        // Interactivity payloads arrive as `{ payload: "<json-string>" }` —
        // unwrap that into a plain object so downstream expressions can read
        // it without a JSON.parse step.
        if let Some(payload_str) = raw.get("payload").and_then(|v| v.as_str()) {
            if let Ok(inner) = serde_json::from_str::<Value>(payload_str) {
                return Ok(NodeOutput::single(vec![inner]));
            }
        }

        // Slash command — emit the canonical fields. We pass through every key
        // Slack sent so users can still read non-standard ones via
        // `{{$json.foo}}`, but the canonical ones are always present.
        let mut out = Map::new();
        for key in [
            "command",
            "text",
            "user_id",
            "user_name",
            "channel_id",
            "channel_name",
            "team_id",
            "team_domain",
            "response_url",
            "trigger_id",
            "api_app_id",
        ] {
            out.insert(
                key.to_string(),
                raw.get(key).cloned().unwrap_or(Value::Null),
            );
        }
        // Copy across any extra fields the receiver added that we don't
        // canonicalise above, except the signature-meta blob.
        if let Some(map) = raw.as_object() {
            for (k, v) in map {
                if k == "__sabflow_meta" {
                    continue;
                }
                out.entry(k.clone()).or_insert_with(|| v.clone());
            }
        }

        Ok(NodeOutput::single(vec![Value::Object(out)]))
    }
}
