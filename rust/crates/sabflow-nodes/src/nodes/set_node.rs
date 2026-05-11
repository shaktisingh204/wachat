//! Set node — set or modify fields on each item flowing through the flow.
//!
//! Operates on every item in the input branch and produces a single output
//! branch.  Each "value" entry is a `{ name, value }` pair; string values run
//! through `ctx.substitute` so `{{var}}` and `{{$json.field}}` tokens are
//! interpolated against the current execution context.
//!
//! When `keepOnlySet` is true, the output object is built from scratch and
//! contains only the keys you set.  Otherwise, the original item is cloned
//! and the new keys are merged in (overwriting where they collide).

use async_trait::async_trait;
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct SetNode;

#[async_trait]
impl Node for SetNode {
    fn descriptor(&self) -> NodeDescriptor {
        let value_children = vec![
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("fieldName")
                .required(),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("Value or {{expression}}"),
        ];

        let mut values_prop =
            NodeProperty::new("values", "Values to Set", NodePropertyType::Collection)
                .description("List of fields to set on each item");
        values_prop.children = value_children;

        NodeDescriptor::new(
            "set",
            "Set",
            "Set or modify item fields",
            NodeCategory::Transform,
        )
        .icon("pencil")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Manual Mapping".into(),
                        value: Value::String("manual".into()),
                        description: Some("Define each field manually".into()),
                    },
                    NodePropertyOption {
                        name: "Expression".into(),
                        value: Value::String("expression".into()),
                        description: Some(
                            "Evaluate an expression for each field".into(),
                        ),
                    },
                ])
                .default(Value::String("manual".into())),
            NodeProperty::new("keepOnlySet", "Keep Only Set", NodePropertyType::Boolean)
                .description("If true, output only the fields you define here")
                .default(Value::Bool(false)),
            values_prop,
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let keep_only = ctx.param_bool(params, "keepOnlySet", false);

        // Collect the list of `{ name, value }` pairs declared on the node.
        // Accept both the Collection-style array form and a plain JSON array.
        let raw_values: Vec<Value> = params
            .get("values")
            .map(|v| match v {
                Value::Array(arr) => arr.clone(),
                Value::Object(map) => {
                    // Some UIs serialize a single collection entry as an object —
                    // tolerate it by wrapping in a one-element array.
                    vec![Value::Object(map.clone())]
                }
                _ => vec![],
            })
            .unwrap_or_default();

        let items = if input.items.is_empty() {
            // Even with no upstream items, run once so a Set node placed at the
            // top of a manual run still produces an output row.
            vec![Value::Object(Map::new())]
        } else {
            input.items
        };

        let mut out_items: Vec<Value> = Vec::with_capacity(items.len());

        for item in items.into_iter() {
            let mut obj: Map<String, Value> = if keep_only {
                Map::new()
            } else {
                match item {
                    Value::Object(map) => map,
                    other => {
                        let mut m = Map::new();
                        m.insert("value".into(), other);
                        m
                    }
                }
            };

            for entry in raw_values.iter() {
                let Some(name) = entry.get("name").and_then(|v| v.as_str()) else {
                    continue;
                };
                if name.is_empty() {
                    continue;
                }
                let value = match entry.get("value") {
                    Some(Value::String(s)) => Value::String(ctx.substitute(s)),
                    Some(other) => other.clone(),
                    None => Value::Null,
                };
                obj.insert(name.to_string(), value);
            }

            out_items.push(Value::Object(obj));
        }

        Ok(NodeOutput::single(out_items))
    }
}
