//! Twilio Trigger node (`n8n-nodes-base.twilioTrigger`).
//!
//! Fires a flow when Twilio sends a webhook event (inbound SMS/MMS, voice
//! call status callbacks, etc.). Twilio delivers webhooks via standard
//! HTTP POST; the upstream catch-all webhook receiver routes the payload
//! into the engine via `ExecutionContext::trigger_data`.
//!
//! Activation contract (consumed by the upstream activator):
//!   - On flow activation an `httpEndpoint` is provisioned at an auto-generated
//!     path. The user pastes that URL into the Twilio console for the relevant
//!     phone number / messaging service / status callback.
//!   - Twilio always POSTs `application/x-www-form-urlencoded`; the receiver
//!     parses that into a JSON object before invoking the engine.
//!
//! This node's `execute` simply surfaces the parsed webhook payload (or an
//! empty object if invoked without trigger data, e.g. a manual test run).

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

pub struct TwilioTriggerNode;

#[async_trait]
impl Node for TwilioTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "twilioTrigger",
            "Twilio Trigger",
            "Fire when Twilio delivers a webhook (inbound message or call event)",
            NodeCategory::Trigger,
        )
        .icon("phone-incoming")
        .color("#F22F46")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "twilioApi".into(),
            display_name: "Twilio Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("updates", "Updates", NodePropertyType::MultiOptions)
                .options(vec![
                    NodePropertyOption {
                        name: "Incoming SMS".into(),
                        value: Value::String("incomingSms".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Incoming MMS".into(),
                        value: Value::String("incomingMms".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Incoming Call".into(),
                        value: Value::String("incomingCall".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Call Status Changed".into(),
                        value: Value::String("callStatus".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Message Status Changed".into(),
                        value: Value::String("messageStatus".into()),
                        description: None,
                    },
                ])
                .default(json!(["incomingSms"]))
                .description(
                    "Which Twilio webhook events should fire this trigger. The activator \
                     registers the generated URL on the matching Twilio resources.",
                ),
            NodeProperty::new("phoneNumber", "Phone Number", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Optional E.164 number to bind the webhook to. Leave blank to attach to \
                     every number on the account.",
                ),
            NodeProperty::new("validateSignature", "Validate Signature", NodePropertyType::Boolean)
                .default(json!(true))
                .description(
                    "Reject inbound requests whose `X-Twilio-Signature` does not match the \
                     credential's authToken. Recommended.",
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
