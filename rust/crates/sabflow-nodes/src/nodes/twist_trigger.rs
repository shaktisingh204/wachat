//! Twist Trigger node (`n8n-nodes-base.twistTrigger`).
//!
//! Fires a flow when Twist (https://twist.com) emits an outgoing webhook —
//! e.g. a new thread, a new comment, or a channel-level event. The upstream
//! catch-all webhook receiver hands the parsed JSON payload to the engine
//! via `ExecutionContext::trigger_data`.
//!
//! Activation contract (consumed by the upstream activator):
//!   - On flow activation, an `httpEndpoint` is provisioned at an auto-generated
//!     path. The activator calls the Twist `integrations` API with the credential
//!     to register the URL against the chosen workspace / channel.
//!   - Twist signs each request with the integration's `install_id`; the
//!     receiver verifies that header before invoking the engine.
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

pub struct TwistTriggerNode;

#[async_trait]
impl Node for TwistTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "twistTrigger",
            "Twist Trigger",
            "Fire when Twist delivers a workspace, channel, thread, or comment event",
            NodeCategory::Trigger,
        )
        .icon("message-square")
        .color("#1E1E1E")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "twistOAuth2Api".into(),
            display_name: "Twist OAuth2 Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("workspaceId", "Workspace ID", NodePropertyType::String)
                .required()
                .description("Numeric Twist workspace identifier the integration is scoped to."),
            NodeProperty::new("event", "Event", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "New Thread".into(),
                        value: Value::String("thread_added".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Thread Updated".into(),
                        value: Value::String("thread_updated".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "New Comment".into(),
                        value: Value::String("comment_added".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Comment Updated".into(),
                        value: Value::String("comment_updated".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "New Channel".into(),
                        value: Value::String("channel_added".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "New Message (Inbox)".into(),
                        value: Value::String("message_added".into()),
                        description: None,
                    },
                ])
                .default(Value::String("thread_added".into()))
                .description("Which Twist event type should fire this trigger."),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Optional — restrict the trigger to events from a single channel. Leave \
                     blank for workspace-wide events.",
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
