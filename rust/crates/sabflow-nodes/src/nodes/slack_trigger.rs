//! Slack trigger node (legacy RTM-style events).
//!
//! n8n type id: `n8n-nodes-base.slackTrigger`.
//!
//! Fires a flow when Slack delivers a real-time message / channel / member
//! event. Like the generic `webhook` trigger, the HTTP receiver lives outside
//! the engine: it parses the Slack event, optionally verifies the HMAC
//! signature against the `slackApi` credential's `signingSecret`, and pushes
//! the event payload onto [`ExecutionContext::trigger_data`].
//!
//! When `execute` runs the trigger has already fired — we simply surface the
//! payload as a single output item so downstream nodes can read
//! `{{$json.event}}`, `{{$json.user}}`, etc.
//!
//! If the receiver hasn't pre-verified the signature, we re-verify it here
//! using the `signingSecret` from the bound `slackApi` credential plus the
//! `X-Slack-Request-Timestamp` header and raw body which the receiver is
//! expected to attach to `trigger_data` under `__sabflow_meta`.

use async_trait::async_trait;
use serde_json::{Value, json};

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

pub struct SlackTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SlackTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "slackTrigger",
            "Slack Trigger",
            "Starts a flow on Slack real-time events (messages, reactions, members)",
            NodeCategory::Trigger,
        )
        .icon("slack")
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
            NodeProperty::new("trigger", "Trigger On", NodePropertyType::Options)
                .options(vec![
                    opt("Any Event", "any"),
                    opt("Message", "message"),
                    opt("Channel Created", "channel_created"),
                    opt("Channel Archive", "channel_archive"),
                    opt("Member Joined Channel", "member_joined_channel"),
                    opt("Reaction Added", "reaction_added"),
                    opt("File Shared", "file_shared"),
                ])
                .default(json!("any"))
                .description("Which Slack event should start this flow"),
            NodeProperty::new(
                "verifySignature",
                "Verify Signature",
                NodePropertyType::Boolean,
            )
            .default(json!(true))
            .description(
                "Re-verify the X-Slack-Signature header on each delivery using \
                     the credential's signing secret. The receiver also verifies this; \
                     leave on for defence in depth.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let payload = ctx.trigger_data.clone().unwrap_or(json!({}));

        if ctx.param_bool(params, "verifySignature", true) {
            let cred_id = ctx
                .param_str_opt(params, "credentialId")
                .unwrap_or_default();
            if !cred_id.is_empty() {
                if let Ok(cred) = ctx.credential(&cred_id) {
                    if let Some(signing_secret) = cred.data.get("signingSecret") {
                        if let Some(meta) = SignatureMeta::from_trigger(&payload) {
                            verify_slack_signature(signing_secret, &meta)?;
                        }
                    }
                }
            }
        }

        Ok(NodeOutput::single(vec![payload]))
    }
}
