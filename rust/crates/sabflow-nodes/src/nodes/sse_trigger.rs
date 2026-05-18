//! Server-Sent Events (SSE) trigger node.
//!
//! Subscribes to a remote Server-Sent Events stream and fires the workflow
//! once per delivered event. The actual long-lived `text/event-stream`
//! reader lives in the SabFlow scheduler/poller — when an event arrives
//! it is delivered to the engine via `ExecutionContext::trigger_data`.
//! This node's `execute` simply surfaces that payload as a single output
//! item so downstream nodes can read it.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct SseTriggerNode;

#[async_trait]
impl Node for SseTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sseTrigger",
            "SSE Trigger",
            "Subscribe to a Server-Sent Events stream and fire on each event",
            NodeCategory::Trigger,
        )
        .icon("activity")
        .color("#10b981")
        .trigger()
        .properties(vec![
            NodeProperty::new("url", "Stream URL", NodePropertyType::String)
                .required()
                .placeholder("https://example.com/events")
                .description("HTTPS endpoint serving text/event-stream."),
            NodeProperty::new("eventFilter", "Event Names", NodePropertyType::String)
                .default(Value::String("".into()))
                .description(
                    "Comma-separated list of `event:` names to subscribe to. Empty = all events.",
                ),
            NodeProperty::new("authentication", "Authentication", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "None".into(),
                        value: Value::String("none".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Bearer Token".into(),
                        value: Value::String("bearerToken".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Header Auth".into(),
                        value: Value::String("headerAuth".into()),
                        description: None,
                    },
                ])
                .default(Value::String("none".into())),
            NodeProperty::new("token", "Token", NodePropertyType::String)
                .default(Value::String("".into()))
                .show_when("authentication", &["bearerToken"]),
            NodeProperty::new("headerName", "Header Name", NodePropertyType::String)
                .default(Value::String("Authorization".into()))
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("headerValue", "Header Value", NodePropertyType::String)
                .default(Value::String("".into()))
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("reconnectDelayMs", "Reconnect Delay (ms)", NodePropertyType::Number)
                .default(json!(3_000))
                .description("Delay before reconnecting after a dropped connection."),
            NodeProperty::new("parseJson", "Parse Event Data as JSON", NodePropertyType::Boolean)
                .default(Value::Bool(true)),
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
