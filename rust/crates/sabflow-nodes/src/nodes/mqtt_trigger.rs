//! MQTT Trigger node (`n8n-nodes-base.mqttTrigger`).
//!
//! In n8n this maintains a long-lived MQTT subscription and fires the flow on
//! every received message. SabFlow runs on Vercel (per project CLAUDE.md),
//! where Functions are short-lived and cannot host a persistent broker
//! connection. We therefore expose the configuration surface for n8n import
//! parity but treat this node as a **bridge stub**: a separate
//! always-on MQTT bridge service (deployed outside the Function tier, e.g.
//! on a Marketplace-provisioned worker) is expected to receive messages
//! and re-emit them into the engine via the internal trigger endpoint.
//!
//! No `rumqttc` / MQTT client dependency is added here — that would only
//! pad the bundle without ever being used inside a Vercel Function.

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

pub struct MqttTriggerNode;

#[async_trait]
impl Node for MqttTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mqttTrigger",
            "MQTT Trigger",
            "Fire on messages from an MQTT topic (bridge-backed)",
            NodeCategory::Trigger,
        )
        .icon("radio-tower")
        .color("#6366f1")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "mqtt".into(),
            display_name: "MQTT Broker".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("topics", "Topics", NodePropertyType::String)
                .default(Value::String("sabflow/#".into()))
                .required()
                .description("Comma-separated topic filters (MQTT wildcards `+` and `#` allowed)."),
            NodeProperty::new("qos", "QoS", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "0 — At most once".into(),
                        value: Value::Number(0.into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "1 — At least once".into(),
                        value: Value::Number(1.into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "2 — Exactly once".into(),
                        value: Value::Number(2.into()),
                        description: None,
                    },
                ])
                .default(Value::Number(0.into())),
            NodeProperty::new(
                "jsonParseBody",
                "JSON-parse Body",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false))
            .description(
                "When enabled, the payload is parsed as JSON and surfaced as `message`; \
                     otherwise the raw UTF-8 string is forwarded.",
            ),
            NodeProperty::new(
                "onlyMessage",
                "Only Message (drop topic + metadata)",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // The bridge forges `{ topic, message, qos, retain }` into trigger_data;
        // a manual test run gets a placeholder so downstream nodes still see an item.
        let payload = ctx.trigger_data.clone().unwrap_or(json!({
            "topic": "",
            "message": "",
            "qos": 0,
            "retain": false,
            "stub": true
        }));
        Ok(NodeOutput::single(vec![payload]))
    }
}
