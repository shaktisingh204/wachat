//! Merge node.
//!
//! Combines items arriving from multiple upstream branches. The engine
//! flattens all upstream items into `input.items` before calling this
//! node, so each mode operates on that flat list.

use async_trait::async_trait;
use serde_json::{json, Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct MergeNode;

#[async_trait]
impl Node for MergeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "merge",
            "Merge",
            "Combine multiple inputs",
            NodeCategory::Logic,
        )
        .icon("merge")
        .color("#6366f1")
        .properties(vec![
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Append".into(),
                        value: json!("append"),
                        description: Some("Concatenate items from every input".into()),
                    },
                    NodePropertyOption {
                        name: "Merge By Key".into(),
                        value: json!("mergeByKey"),
                        description: Some("Pair items that share a field value".into()),
                    },
                    NodePropertyOption {
                        name: "Multiplex".into(),
                        value: json!("multiplex"),
                        description: Some("Cartesian product across inputs".into()),
                    },
                    NodePropertyOption {
                        name: "Pick First".into(),
                        value: json!("pickFirst"),
                        description: Some("Emit only the first non-empty item".into()),
                    },
                ])
                .default(json!("append"))
                .required(),
            NodeProperty::new("mergeByField", "Merge By Field", NodePropertyType::String)
                .placeholder("id")
                .show_when("mode", &["mergeByKey"]),
            NodeProperty::new(
                "includeUnpaired",
                "Include Unpaired Items",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .show_when("mode", &["mergeByKey"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let mode = ctx
            .param_str_opt(params, "mode")
            .unwrap_or_else(|| "append".to_string());

        let items = input.items;

        match mode.as_str() {
            "append" => Ok(NodeOutput::single(items)),

            "mergeByKey" => {
                let field = ctx.param_str_opt(params, "mergeByField").unwrap_or_default();
                let include_unpaired = ctx.param_bool(params, "includeUnpaired", false);

                if field.is_empty() {
                    // No key configured — fall back to pass-through.
                    // TODO(sabflow): require mergeByField once the UI enforces it.
                    return Ok(NodeOutput::single(items));
                }

                // Bucket items by the value found at the configured key.
                // TODO(sabflow): switch to per-branch buckets once the engine
                // exposes second-branch input alongside `input.items`.
                let mut buckets: Vec<(Value, Map<String, Value>)> = Vec::new();
                let mut unpaired: Vec<Value> = Vec::new();

                for item in items.into_iter() {
                    let key_val = value_at(&item, &field).cloned();
                    match key_val {
                        Some(k) if !k.is_null() => {
                            if let Some((_, existing)) =
                                buckets.iter_mut().find(|(bk, _)| bk == &k)
                            {
                                if let Some(obj) = item.as_object() {
                                    for (k2, v2) in obj.iter() {
                                        existing.insert(k2.clone(), v2.clone());
                                    }
                                }
                            } else if let Some(obj) = item.as_object() {
                                buckets.push((k, obj.clone()));
                            } else {
                                unpaired.push(item);
                            }
                        }
                        _ => unpaired.push(item),
                    }
                }

                let mut out: Vec<Value> = buckets
                    .into_iter()
                    .map(|(_, m)| Value::Object(m))
                    .collect();

                if include_unpaired {
                    out.extend(unpaired);
                }

                Ok(NodeOutput::single(out))
            }

            "multiplex" => {
                // TODO(sabflow): real cartesian needs per-branch inputs. For now
                // pass through — N items in -> N items out.
                Ok(NodeOutput::single(items))
            }

            "pickFirst" => {
                let first = items
                    .into_iter()
                    .find(|v| !is_empty_object(v))
                    .map(|v| vec![v])
                    .unwrap_or_default();
                Ok(NodeOutput::single(first))
            }

            other => Err(NodeError::InvalidParameter {
                name: "mode".into(),
                reason: format!("unknown merge mode: {other}"),
            }),
        }
    }
}

/// Navigate a dotted path on a JSON value (e.g. `"user.id"`).
fn value_at<'a>(v: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(v);
    }
    let mut cur = v;
    for part in path.split('.') {
        cur = cur.get(part)?;
    }
    Some(cur)
}

fn is_empty_object(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::Object(m) => m.is_empty(),
        Value::Array(a) => a.is_empty(),
        _ => false,
    }
}
