//! Webhook trigger node.
//!
//! Fires a flow when a public HTTP webhook receives a request. The actual
//! HTTP receiver lives outside the engine; when it fires, the request
//! payload is handed to the engine via `ExecutionContext::trigger_data`.
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

pub struct WebhookTriggerNode;

#[async_trait]
impl Node for WebhookTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "webhook",
            "Webhook",
            "HTTP webhook trigger",
            NodeCategory::Trigger,
        )
        .icon("webhook")
        .color("#8b5cf6")
        .trigger()
        .properties(vec![
            NodeProperty::new("httpMethod", "HTTP Method", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "GET".into(),
                        value: Value::String("GET".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "POST".into(),
                        value: Value::String("POST".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "PUT".into(),
                        value: Value::String("PUT".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "PATCH".into(),
                        value: Value::String("PATCH".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "DELETE".into(),
                        value: Value::String("DELETE".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "ANY".into(),
                        value: Value::String("ANY".into()),
                        description: None,
                    },
                ])
                .default(Value::String("POST".into())),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .default(Value::String("".into()))
                .description(
                    "Auto-generated if empty; the actual webhookId is created at activation time.",
                ),
            NodeProperty::new("authentication", "Authentication", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "None".into(),
                        value: Value::String("none".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Header Auth".into(),
                        value: Value::String("headerAuth".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Basic Auth".into(),
                        value: Value::String("basicAuth".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Query Auth".into(),
                        value: Value::String("queryAuth".into()),
                        description: None,
                    },
                ])
                .default(Value::String("none".into())),
            NodeProperty::new("responseMode", "Response Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Immediately on Received".into(),
                        value: Value::String("onReceived".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "When Last Node Finishes".into(),
                        value: Value::String("lastNode".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Using Respond to Webhook Node".into(),
                        value: Value::String("responseNode".into()),
                        description: None,
                    },
                ])
                .default(Value::String("onReceived".into())),
            NodeProperty::new("responseCode", "Response Code", NodePropertyType::Number)
                .default(json!(200))
                .show_when("responseMode", &["onReceived"]),
            NodeProperty::new("responseData", "Response Data", NodePropertyType::String)
                .default(Value::String("firstEntryJson".into()))
                .show_when("responseMode", &["onReceived"]),
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
