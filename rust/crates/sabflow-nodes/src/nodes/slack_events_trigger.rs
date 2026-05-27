//! Slack Events API trigger.
//!
//! n8n type id: `n8n-nodes-base.slackEventsApiTrigger`.
//!
//! Subscribes to Slack's Events API. Slack POSTs three different envelope
//! types to the Request URL:
//!
//! 1. `url_verification` — the one-shot subscription handshake. The receiver
//!    is expected to respond with the `challenge` value verbatim (status 200,
//!    `text/plain` body). We surface the challenge on the emitted item so the
//!    `Respond to Webhook` node downstream can echo it.
//! 2. `event_callback` — a real subscribed event (message, reaction_added,
//!    app_mention, …). The inner `event` object is what users actually want;
//!    we emit it as the top-level item with the outer envelope fields
//!    (`team_id`, `event_id`, `event_time`, …) attached as siblings.
//! 3. `app_rate_limited` — Slack telling us we exceeded our limits. Surfaced
//!    as-is for observability.
//!
//! Signature verification uses HMAC-SHA256 over
//! `v0:{timestamp}:{raw_body}` with the credential's `signingSecret`, per the
//! Slack docs. The receiver also performs this check, but we re-verify here
//! for defence in depth if the receiver attached the meta blob.

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

pub struct SlackEventsApiTriggerNode;

#[allow(dead_code)]
fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SlackEventsApiTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "slackEventsApiTrigger",
            "Slack Events API",
            "Subscribes to Slack Events API events (messages, reactions, app_mention, …)",
            NodeCategory::Trigger,
        )
        .icon("zap")
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
            NodeProperty::new("eventTypes", "Event Types", NodePropertyType::String)
                .placeholder("app_mention,message.channels")
                .description(
                    "Comma-separated list of event subtypes to forward (leave empty for all). \
                     Slack itself filters by subscription scope; this is an additional client-side filter.",
                ),
            NodeProperty::new("verifySignature", "Verify Signature", NodePropertyType::Boolean)
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

        // 1) URL verification handshake — short-circuit and return the
        //    challenge so the Respond-to-Webhook node downstream can echo it.
        if raw.get("type").and_then(|v| v.as_str()) == Some("url_verification") {
            let challenge = raw
                .get("challenge")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            return Ok(NodeOutput::single(vec![json!({
                "type": "url_verification",
                "challenge": challenge,
            })]));
        }

        // 2) Verify signature on real event callbacks if a meta blob was
        //    supplied by the receiver.
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

        // 3) Optional client-side event-type filter.
        let filter_csv = ctx.param_str_opt(params, "eventTypes").unwrap_or_default();
        let allow: Vec<String> = filter_csv
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        // 4) Surface the event envelope. For `event_callback` envelopes we
        //    lift the inner `event` to the top so user expressions can read
        //    `{{$json.user}}`, `{{$json.text}}`, etc. without an extra hop.
        let envelope_type = raw.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if envelope_type == "event_callback" {
            let inner = raw.get("event").cloned().unwrap_or_else(|| json!({}));
            let inner_type = inner.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if !allow.is_empty() && !allow.iter().any(|t| t == inner_type) {
                return Ok(NodeOutput::single(vec![]));
            }
            let mut out: Map<String, Value> = match inner {
                Value::Object(m) => m,
                other => {
                    let mut m = Map::new();
                    m.insert("event".to_string(), other);
                    m
                }
            };
            // Attach interesting envelope fields as siblings.
            for key in [
                "team_id",
                "api_app_id",
                "event_id",
                "event_time",
                "event_context",
            ] {
                if let Some(v) = raw.get(key) {
                    out.entry(key.to_string()).or_insert_with(|| v.clone());
                }
            }
            return Ok(NodeOutput::single(vec![Value::Object(out)]));
        }

        // 5) Anything else (`app_rate_limited`, future envelope types) —
        //    emit unchanged minus the signature meta blob.
        let mut out: Map<String, Value> = match raw {
            Value::Object(m) => m,
            other => {
                let mut m = Map::new();
                m.insert("payload".to_string(), other);
                m
            }
        };
        out.remove("__sabflow_meta");
        Ok(NodeOutput::single(vec![Value::Object(out)]))
    }
}
