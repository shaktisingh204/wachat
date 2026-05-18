//! Item Lists node — aggregate / split / sort / limit / dedupe items.
//!
//! Mirrors a subset of n8n's `n8n-nodes-base.itemLists`. The most useful
//! operations in real flows are covered here:
//!
//! - `aggregateItems`: collect a field across all input items into an array.
//! - `splitOutItems`:  the inverse — take an array field and emit one item
//!   per element.
//! - `limit`:          keep the first N items.
//! - `sort`:           sort by a field ascending or descending.
//! - `removeDuplicates`: dedupe by a field, keeping the first occurrence.
//!
//! Pure local computation; no HTTP.

use async_trait::async_trait;
use std::collections::HashSet;

use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ItemListsNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn value_at_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(root);
    }
    let mut cur = root;
    for segment in path.split('.') {
        if segment.is_empty() {
            continue;
        }
        cur = cur.get(segment)?;
    }
    Some(cur)
}

/// Stable JSON-aware compare. Numbers compare numerically; everything else
/// falls back to the string representation.
fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    if let (Some(an), Some(bn)) = (a.as_f64(), b.as_f64()) {
        return an.partial_cmp(&bn).unwrap_or(Ordering::Equal);
    }
    let as_str = |v: &Value| match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    };
    as_str(a).cmp(&as_str(b))
}

#[async_trait]
impl Node for ItemListsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "itemLists",
            "Item Lists",
            "Aggregate, split, sort, limit, and dedupe items",
            NodeCategory::Transform,
        )
        .icon("list")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Aggregate Items", "aggregateItems"),
                    opt("Split Out Items", "splitOutItems"),
                    opt("Limit", "limit"),
                    opt("Sort", "sort"),
                    opt("Remove Duplicates", "removeDuplicates"),
                ])
                .default(json!("splitOutItems"))
                .required(),
            NodeProperty::new("fieldPath", "Field", NodePropertyType::String)
                .description("Field to operate on (dot-path, e.g. `address.city`)")
                .placeholder("items"),
            NodeProperty::new("outputKey", "Output Key", NodePropertyType::String)
                .description("Key under which the aggregated array is written")
                .show_when("operation", &["aggregateItems"])
                .default(json!("data")),
            NodeProperty::new("limit", "Max Items", NodePropertyType::Number)
                .show_when("operation", &["limit"])
                .default(json!(10)),
            NodeProperty::new("direction", "Direction", NodePropertyType::Options)
                .options(vec![opt("Ascending", "asc"), opt("Descending", "desc")])
                .show_when("operation", &["sort"])
                .default(json!("asc")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let field_path = ctx.param_str_opt(params, "fieldPath").unwrap_or_default();
        let items = input.items;

        let out: Vec<Value> = match operation.as_str() {
            "aggregateItems" => {
                let output_key = ctx
                    .param_str_opt(params, "outputKey")
                    .unwrap_or_else(|| "data".to_string());
                let collected: Vec<Value> = if field_path.is_empty() {
                    items
                } else {
                    items
                        .iter()
                        .map(|it| value_at_path(it, &field_path).cloned().unwrap_or(Value::Null))
                        .collect()
                };
                let mut obj = Map::new();
                obj.insert(output_key, Value::Array(collected));
                vec![Value::Object(obj)]
            }
            "splitOutItems" => {
                if field_path.is_empty() {
                    return Err(NodeError::MissingParameter("fieldPath".into()));
                }
                let mut out_items: Vec<Value> = Vec::new();
                for item in items.into_iter() {
                    let arr = value_at_path(&item, &field_path).cloned();
                    match arr {
                        Some(Value::Array(elements)) => {
                            for el in elements.into_iter() {
                                match el {
                                    Value::Object(_) => out_items.push(el),
                                    other => {
                                        let mut m = Map::new();
                                        m.insert("value".into(), other);
                                        out_items.push(Value::Object(m));
                                    }
                                }
                            }
                        }
                        Some(other) => {
                            // Not an array — wrap a single value.
                            let mut m = Map::new();
                            m.insert("value".into(), other);
                            out_items.push(Value::Object(m));
                        }
                        None => {}
                    }
                }
                out_items
            }
            "limit" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as usize)
                    .unwrap_or(10);
                items.into_iter().take(limit).collect()
            }
            "sort" => {
                let direction = ctx
                    .param_str_opt(params, "direction")
                    .unwrap_or_else(|| "asc".to_string());
                let mut items = items;
                items.sort_by(|a, b| {
                    let av = value_at_path(a, &field_path).cloned().unwrap_or(Value::Null);
                    let bv = value_at_path(b, &field_path).cloned().unwrap_or(Value::Null);
                    let ord = compare_values(&av, &bv);
                    if direction == "desc" { ord.reverse() } else { ord }
                });
                items
            }
            "removeDuplicates" => {
                let mut seen: HashSet<String> = HashSet::new();
                let mut out_items: Vec<Value> = Vec::with_capacity(items.len());
                for item in items.into_iter() {
                    let key_val = if field_path.is_empty() {
                        item.to_string()
                    } else {
                        value_at_path(&item, &field_path)
                            .map(|v| v.to_string())
                            .unwrap_or_default()
                    };
                    if seen.insert(key_val) {
                        out_items.push(item);
                    }
                }
                out_items
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(out))
    }
}
