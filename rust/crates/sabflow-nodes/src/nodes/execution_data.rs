//! Execution Data node — n8n parity.
//!
//! Origin: `n8n-nodes-base.executionData`. In n8n, this node reads or writes
//! `static_data` / `workflow_static_data` — small cross-execution KV state
//! that lives next to the workflow record.
//!
//! SabFlow's `ctx.variables` map is the engine's per-run state surface. The
//! engine seeds it with execution metadata (`executionId`, `startedAt`) and
//! lets nodes use it as scratch space. We mirror n8n's two operations:
//!
//!   - `set`  → write a key/value pair into `ctx.variables` so later nodes
//!              and the persistent store can pick it up.
//!   - `read` → look up a key (or all execution metadata when `key` is empty)
//!              and emit it as a single item.

use async_trait::async_trait;
use serde_json::{json, Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ExecutionDataNode;

#[async_trait]
impl Node for ExecutionDataNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "executionData",
            "Execution Data",
            "Read or write per-execution static data",
            NodeCategory::Developer,
        )
        .icon("database")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Read".into(),
                        value: json!("read"),
                        description: Some("Read a key from execution data".into()),
                    },
                    NodePropertyOption {
                        name: "Set".into(),
                        value: json!("set"),
                        description: Some("Write a key/value into execution data".into()),
                    },
                ])
                .default(json!("read"))
                .required(),
            NodeProperty::new("key", "Key", NodePropertyType::String)
                .default(json!(""))
                .description(
                    "Variable name. When reading and left blank, the full \
                     execution metadata snapshot is returned.",
                ),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .default(json!(""))
                .description("Value to store (JSON-parsed when possible)")
                .show_when("operation", &["set"]),
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
            .unwrap_or_else(|| "read".to_string());

        match op.as_str() {
            "read" => {
                let key = ctx.param_str_opt(params, "key").unwrap_or_default();
                if key.is_empty() {
                    // Whole-snapshot read: surface engine-seeded metadata
                    // alongside everything else in `ctx.variables`.
                    let mut snap = serde_json::Map::new();
                    snap.insert(
                        "executionId".into(),
                        Value::String(ctx.execution_id.clone()),
                    );
                    for (k, v) in &ctx.variables {
                        snap.insert(k.clone(), v.clone());
                    }
                    Ok(NodeOutput::single(vec![Value::Object(snap)]))
                } else {
                    let v = ctx
                        .variables
                        .get(&key)
                        .cloned()
                        .unwrap_or(Value::Null);
                    let mut row = Map::new();
                    row.insert(key.clone(), v);
                    Ok(NodeOutput::single(vec![Value::Object(row)]))
                }
            }
            "set" => {
                let key = ctx.param_str(params, "key")?;
                if key.is_empty() {
                    return Err(NodeError::InvalidParameter {
                        name: "key".into(),
                        reason: "must be non-empty when operation is 'set'".into(),
                    });
                }
                let raw = ctx.param_str_opt(params, "value").unwrap_or_default();
                // Try JSON-parse first so callers can store objects/arrays;
                // otherwise treat the string literally.
                let parsed: Value = serde_json::from_str(raw.trim())
                    .unwrap_or_else(|_| Value::String(raw.clone()));
                ctx.variables.insert(key.clone(), parsed.clone());
                // Pass items through so this node can sit mid-flow without
                // disturbing the data stream — the recorded value is added
                // as a sidecar field on each item for visibility.
                let items_out: Vec<Value> = if input.items.is_empty() {
                    let mut row = Map::new();
                    row.insert(key.clone(), parsed);
                    vec![Value::Object(row)]
                } else {
                    input
                        .items
                        .into_iter()
                        .map(|item| match item {
                            Value::Object(mut m) => {
                                m.insert(key.clone(), parsed.clone());
                                Value::Object(m)
                            }
                            other => {
                                let mut row = Map::new();
                                row.insert("item".to_string(), other);
                                row.insert(key.clone(), parsed.clone());
                                Value::Object(row)
                            }
                        })
                        .collect()
                };
                Ok(NodeOutput::single(items_out))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}
