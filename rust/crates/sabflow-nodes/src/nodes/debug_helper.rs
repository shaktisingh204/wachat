//! Debug Helper node — n8n parity.
//!
//! Origin: `n8n-nodes-base.debugHelper`. Two operations:
//!
//!   - `log`         → annotate the run transcript with a labelled message
//!                     and emit the incoming items unchanged.
//!   - `random_data` → produce N synthetic items (currently `user` or
//!                     `address` shapes) for use as test fixtures.
//!
//! "Logging" inside the Rust engine means stashing the rendered line as a
//! sidecar field on each output item AND `tracing::info!`-ing it so it
//! shows up in the worker's structured log. The Node-side TypeScript glue
//! is what actually surfaces it in the run sidebar.

use async_trait::async_trait;
use serde_json::{json, Value};
use tracing::{error, info, warn};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct DebugHelperNode;

#[async_trait]
impl Node for DebugHelperNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "debugHelper",
            "Debug Helper",
            "Emit log lines or seed synthetic test data",
            NodeCategory::Developer,
        )
        .icon("bug")
        .color("#a855f7")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Log".into(),
                        value: json!("log"),
                        description: Some("Append a labelled line to the run transcript".into()),
                    },
                    NodePropertyOption {
                        name: "Random Data".into(),
                        value: json!("random_data"),
                        description: Some("Emit a sample payload of the requested shape".into()),
                    },
                ])
                .default(json!("log"))
                .required(),
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .default(json!(""))
                .placeholder("Anything you want to see in the run log")
                .show_when("operation", &["log"]),
            NodeProperty::new("level", "Level", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Info".into(),
                        value: json!("info"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Warn".into(),
                        value: json!("warn"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Error".into(),
                        value: json!("error"),
                        description: None,
                    },
                ])
                .default(json!("info"))
                .show_when("operation", &["log"]),
            NodeProperty::new("shape", "Shape", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "User".into(),
                        value: json!("user"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Address".into(),
                        value: json!("address"),
                        description: None,
                    },
                ])
                .default(json!("user"))
                .show_when("operation", &["random_data"]),
            NodeProperty::new("count", "Count", NodePropertyType::Number)
                .default(json!(3))
                .show_when("operation", &["random_data"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let op = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "log".to_string());

        match op.as_str() {
            "log" => {
                let message = ctx.param_str_opt(params, "message").unwrap_or_default();
                let level = ctx
                    .param_str_opt(params, "level")
                    .unwrap_or_else(|| "info".to_string());
                let line = format!("[{}] {}", level.to_uppercase(), message);

                match level.as_str() {
                    "warn" => warn!(target: "sabflow.debug_helper", "{line}"),
                    "error" => error!(target: "sabflow.debug_helper", "{line}"),
                    _ => info!(target: "sabflow.debug_helper", "{line}"),
                }

                let items_out: Vec<Value> = if input.items.is_empty() {
                    vec![json!({ "logged": true, "message": line })]
                } else {
                    let tag = line;
                    input
                        .items
                        .into_iter()
                        .map(|item| match item {
                            Value::Object(mut m) => {
                                m.insert("__debug".into(), Value::String(tag.clone()));
                                Value::Object(m)
                            }
                            other => json!({ "item": other, "__debug": tag.clone() }),
                        })
                        .collect()
                };
                Ok(NodeOutput::single(items_out))
            }

            "random_data" => {
                let shape = ctx
                    .param_str_opt(params, "shape")
                    .unwrap_or_else(|| "user".to_string());
                let count = ctx
                    .param_f64(params, "count")
                    .map(|n| n as i64)
                    .unwrap_or(3)
                    .clamp(1, 100) as usize;

                let items: Vec<Value> = (0..count)
                    .map(|i| match shape.as_str() {
                        "address" => sample_address(i),
                        _ => sample_user(i),
                    })
                    .collect();
                Ok(NodeOutput::single(items))
            }

            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn sample_user(i: usize) -> Value {
    json!({
        "id": i + 1,
        "name": format!("User {}", i + 1),
        "email": format!("user{}@example.com", i + 1),
        "age": 20 + (i % 40),
    })
}

fn sample_address(i: usize) -> Value {
    json!({
        "id": i + 1,
        "street": format!("{} Main St", 100 + i),
        "city": "Springfield",
        "zip": format!("0{}", 1000 + i),
    })
}
