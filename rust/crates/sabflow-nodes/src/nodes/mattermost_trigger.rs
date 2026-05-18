//! Mattermost Trigger node (`n8n-nodes-base.mattermostTrigger`).
//!
//! Fires a flow when Mattermost delivers an outgoing webhook (slash command,
//! outgoing webhook on a trigger-word post, or a configured integration
//! event). The upstream catch-all webhook receiver hands the parsed payload
//! to the engine via `ExecutionContext::trigger_data`.
//!
//! Activation contract (consumed by the upstream activator):
//!   - On flow activation, an `httpEndpoint` is provisioned at an auto-generated
//!     path. The user (or the Mattermost-admin REST call performed by the
//!     activator) registers that URL as the outgoing-webhook callback URL.
//!   - The Mattermost server posts JSON (or x-www-form-urlencoded for legacy
//!     outgoing webhooks). The receiver normalises into JSON before invoking
//!     the engine.
//!
//! This node's `execute` simply surfaces the parsed payload (or an empty
//! object if invoked without trigger data, e.g. a manual test run).

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

pub struct MattermostTriggerNode;

#[async_trait]
impl Node for MattermostTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mattermostTrigger",
            "Mattermost Trigger",
            "Fire when Mattermost delivers an outgoing webhook or slash command",
            NodeCategory::Trigger,
        )
        .icon("message-circle")
        .color("#0072C6")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "mattermostApi".into(),
            display_name: "Mattermost Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("triggerType", "Trigger Type", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Outgoing Webhook".into(),
                        value: Value::String("outgoingWebhook".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Slash Command".into(),
                        value: Value::String("slashCommand".into()),
                        description: None,
                    },
                ])
                .default(Value::String("outgoingWebhook".into()))
                .description("Which Mattermost integration mechanism delivers this event."),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                .required()
                .description("Mattermost team that owns the outgoing webhook / slash command."),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Optional — restrict the outgoing webhook to a single channel. Required \
                     when triggerType is outgoingWebhook and a non-public channel is targeted.",
                )
                .show_when("triggerType", &["outgoingWebhook"]),
            NodeProperty::new("triggerWords", "Trigger Words", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Comma-separated list of words that should fire the outgoing webhook. \
                     Leave blank to fire on every message in the channel.",
                )
                .show_when("triggerType", &["outgoingWebhook"]),
            NodeProperty::new("command", "Slash Command", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "The slash command (without the leading `/`) that should invoke this \
                     trigger, e.g. `deploy`.",
                )
                .show_when("triggerType", &["slashCommand"]),
            NodeProperty::new("validateToken", "Validate Token", NodePropertyType::Boolean)
                .default(json!(true))
                .description(
                    "Reject inbound requests whose `token` field does not match the \
                     credential's verification token. Recommended.",
                ),
            NodeProperty::new("path", "Webhook Path", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Auto-generated if empty; finalised at activation time and routed by the \
                     catch-all webhook receiver.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(vec![ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({}))]))
    }
}
