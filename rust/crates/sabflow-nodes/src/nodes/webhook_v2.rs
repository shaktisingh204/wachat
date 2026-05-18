//! Webhook v2 trigger node.
//!
//! Versioned webhook trigger that extends the base `webhook` node with
//! richer authentication options (Bearer, HMAC signature) and a wider set
//! of response modes (no-body, custom JSON, last-node). Like the original
//! webhook, the HTTP receiver lives outside the engine; when a request
//! arrives the payload is delivered via `ExecutionContext::trigger_data`
//! and this node simply surfaces it as the trigger output.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct WebhookV2Node;

#[async_trait]
impl Node for WebhookV2Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "webhookV2",
            "Webhook (v2)",
            "Versioned HTTP webhook trigger with extended auth + response modes",
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
                    NodePropertyOption {
                        name: "Bearer Token".into(),
                        value: Value::String("bearerToken".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "HMAC Signature".into(),
                        value: Value::String("hmacSignature".into()),
                        description: None,
                    },
                ])
                .default(Value::String("none".into())),
            NodeProperty::new("hmacAlgorithm", "HMAC Algorithm", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "SHA-256".into(),
                        value: Value::String("sha256".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "SHA-1".into(),
                        value: Value::String("sha1".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "SHA-512".into(),
                        value: Value::String("sha512".into()),
                        description: None,
                    },
                ])
                .default(Value::String("sha256".into()))
                .show_when("authentication", &["hmacSignature"]),
            NodeProperty::new("hmacHeader", "HMAC Header Name", NodePropertyType::String)
                .default(Value::String("X-Hub-Signature-256".into()))
                .show_when("authentication", &["hmacSignature"]),
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
                    NodePropertyOption {
                        name: "No Body (204)".into(),
                        value: Value::String("noBody".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Custom JSON".into(),
                        value: Value::String("customJson".into()),
                        description: None,
                    },
                ])
                .default(Value::String("onReceived".into())),
            NodeProperty::new("responseCode", "Response Code", NodePropertyType::Number)
                .default(json!(200))
                .show_when("responseMode", &["onReceived", "customJson"]),
            NodeProperty::new("responseData", "Response Data", NodePropertyType::String)
                .default(Value::String("firstEntryJson".into()))
                .show_when("responseMode", &["onReceived"]),
            NodeProperty::new("responseJson", "Response JSON", NodePropertyType::Json)
                .default(json!({ "ok": true }))
                .show_when("responseMode", &["customJson"]),
            NodeProperty::new("rawBody", "Pass Raw Body", NodePropertyType::Boolean)
                .default(Value::Bool(false))
                .description("If true, the request body is forwarded as a raw string instead of parsed JSON."),
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
