//! GraphQL subscription trigger node.
//!
//! Subscribes to a GraphQL subscription over `graphql-ws` (or `graphql-transport-ws`)
//! and fires the workflow once per delivered payload. The websocket reader
//! lives in the SabFlow scheduler/poller — when a subscription event arrives
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

pub struct GraphqlTriggerNode;

#[async_trait]
impl Node for GraphqlTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "graphqlTrigger",
            "GraphQL Trigger",
            "Listen to a GraphQL subscription and fire on each payload",
            NodeCategory::Trigger,
        )
        .icon("share-2")
        .color("#e535ab")
        .trigger()
        .properties(vec![
            NodeProperty::new("endpoint", "Endpoint URL", NodePropertyType::String)
                .required()
                .placeholder("wss://example.com/graphql")
                .description("GraphQL websocket endpoint (wss:// or ws://)."),
            NodeProperty::new("protocol", "Sub-protocol", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "graphql-transport-ws".into(),
                        value: Value::String("graphql-transport-ws".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "graphql-ws (legacy)".into(),
                        value: Value::String("graphql-ws".into()),
                        description: None,
                    },
                ])
                .default(Value::String("graphql-transport-ws".into())),
            NodeProperty::new("query", "Subscription Query", NodePropertyType::Code)
                .required()
                .placeholder("subscription OnMessage { newMessage { id text } }")
                .description("The GraphQL subscription document to execute."),
            NodeProperty::new("variables", "Variables", NodePropertyType::Json)
                .default(json!({}))
                .description("Optional variables passed alongside the subscription."),
            NodeProperty::new("operationName", "Operation Name", NodePropertyType::String)
                .default(Value::String("".into())),
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
                        name: "Connection Params".into(),
                        value: Value::String("connectionParams".into()),
                        description: None,
                    },
                ])
                .default(Value::String("none".into())),
            NodeProperty::new("token", "Token", NodePropertyType::String)
                .default(Value::String("".into()))
                .show_when("authentication", &["bearerToken"]),
            NodeProperty::new("connectionParams", "Connection Params (JSON)", NodePropertyType::Json)
                .default(json!({}))
                .show_when("authentication", &["connectionParams"])
                .description("Sent on the `connection_init` message."),
            NodeProperty::new("reconnectDelayMs", "Reconnect Delay (ms)", NodePropertyType::Number)
                .default(json!(3_000)),
            NodeProperty::new(
                "emitErrors",
                "Emit GraphQL Errors as Items",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false))
            .description("If true, error payloads are forwarded as items instead of being dropped."),
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
