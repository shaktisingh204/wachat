//! Item Lists node — aggregate, split, sort, limit, and dedupe item streams.
//!
//! Mirrors n8n's `itemLists` node. Operations:
//!
//!   - `splitOutItems` : explode a list-shaped field into one item per entry.
//!     The remaining fields are kept on each split item.
//!   - `aggregateItems`: collapse all upstream items into a single item, with
//!     the given fields gathered into arrays.
//!   - `sort`          : sort the input branch by `sortField`, asc or desc.
//!   - `limit`         : keep the first / last N items.
//!   - `removeDuplicates`: drop items whose value at `compareField` repeats.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};
use std::collections::HashSet;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ItemListsNode;

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
                    NodePropertyOption {
                        name: "Split Out Items".into(),
                        value: json!("splitOutItems"),
                        description: Some("Explode a list field into multiple items".into()),
                    },
                    NodePropertyOption {
                        name: "Aggregate Items".into(),
                        value: json!("aggregateItems"),
                        description: Some("Combine items into one with arrays".into()),
                    },
                    NodePropertyOption {
                        name: "Sort".into(),
                        value: json!("sort"),
                        description: Some("Sort items by a field".into()),
                    },
                    NodePropertyOption {
                        name: "Limit".into(),
                        value: json!("limit"),
                        description: Some("Keep first / last N items".into()),
                    },
                    NodePropertyOption {
                        name: "Remove Duplicates".into(),
                        value: json!("removeDuplicates"),
                        description: Some("Drop repeating items by field value".into()),
                    },
                ])
                .default(json!("splitOutItems"))
                .required(),
            NodeProperty::new("fieldToSplitOut", "Field to Split Out", NodePropertyType::String)
                .placeholder("items")
                .show_when("operation", &["splitOutItems"])
                .required(),
            NodeProperty::new("aggregateField", "Field to Aggregate", NodePropertyType::String)
                .description("Single field to collect across all items")
                .placeholder("name")
                .show_when("operation", &["aggregateItems"])
                .required(),
            NodeProperty::new("aggregateAs", "Output Field Name", NodePropertyType::String)
                .description("Key to hold the aggregated array")
                .placeholder("names")
                .show_when("operation", &["aggregateItems"]),
            NodeProperty::new("sortField", "Sort Field", NodePropertyType::String)
                .placeholder("createdAt")
                .show_when("operation", &["sort"])
                .required(),
            NodeProperty::new("sortDirection", "Direction", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Ascending".into(),
                        value: json!("asc"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Descending".into(),
                        value: json!("desc"),
                        description: None,
                    },
                ])
                .default(json!("asc"))
                .show_when("operation", &["sort"]),
            NodeProperty::new("maxItems", "Max Items", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["limit"]),
            NodeProperty::new("keep", "Keep", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "First".into(),
                        value: json!("first"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Last".into(),
                        value: json!("last"),
                        description: None,
                    },
                ])
                .default(json!("first"))
                .show_when("operation", &["limit"]),
            NodeProperty::new("compareField", "Compare Field", NodePropertyType::String)
                .description("Field whose value identifies duplicates (blank → whole item)")
                .show_when("operation", &["removeDuplicates"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "splitOutItems" => {
                let field = ctx.param_str(params, "fieldToSplitOut")?;
                let mut out: Vec<Value> = Vec::new();
                for item in input.items.into_iter() {
                    let list = item.get(&field).cloned().unwrap_or(Value::Null);
                    match list {
                        Value::Array(entries) => {
                            for entry in entries {
                                out.push(combine(&item, &field, entry));
                            }
                        }
                        Value::Null => {
                            // Pass through unchanged.
                            out.push(item);
                        }
                        other => {
                            out.push(combine(&item, &field, other));
                        }
                    }
                }
                Ok(NodeOutput::single(out))
            }
            "aggregateItems" => {
                let field = ctx.param_str(params, "aggregateField")?;
                let alias = ctx
                    .param_str_opt(params, "aggregateAs")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("{field}s"));

                let values: Vec<Value> = input
                    .items
                    .iter()
                    .filter_map(|i| i.get(&field).cloned())
                    .collect();

                let mut obj = Map::new();
                obj.insert(alias, Value::Array(values));
                Ok(NodeOutput::single(vec![Value::Object(obj)]))
            }
            "sort" => {
                let field = ctx.param_str(params, "sortField")?;
                let direction = ctx
                    .param_str_opt(params, "sortDirection")
                    .unwrap_or_else(|| "asc".to_string());
                let mut items = input.items;
                items.sort_by(|a, b| compare_values(a.get(&field), b.get(&field)));
                if direction == "desc" {
                    items.reverse();
                }
                Ok(NodeOutput::single(items))
            }
            "limit" => {
                let max = ctx
                    .param_f64(params, "maxItems")
                    .map(|n| n as usize)
                    .unwrap_or(10);
                let keep = ctx
                    .param_str_opt(params, "keep")
                    .unwrap_or_else(|| "first".to_string());
                let items = input.items;
                let limited: Vec<Value> = if keep == "last" {
                    items.into_iter().rev().take(max).collect::<Vec<_>>().into_iter().rev().collect()
                } else {
                    items.into_iter().take(max).collect()
                };
                Ok(NodeOutput::single(limited))
            }
            "removeDuplicates" => {
                let field = ctx
                    .param_str_opt(params, "compareField")
                    .filter(|s| !s.is_empty());

                let mut seen: HashSet<String> = HashSet::new();
                let mut out: Vec<Value> = Vec::new();
                for item in input.items.into_iter() {
                    let key = match &field {
                        Some(f) => item
                            .get(f)
                            .map(value_to_dedupe_key)
                            .unwrap_or_default(),
                        None => value_to_dedupe_key(&item),
                    };
                    if seen.insert(key) {
                        out.push(item);
                    }
                }
                Ok(NodeOutput::single(out))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Merge `original` (minus the splat-out field) with one exploded `entry`.
/// If `entry` is itself an object, its keys take precedence; otherwise the
/// scalar is stored back under the splat-out field name.
fn combine(original: &Value, field: &str, entry: Value) -> Value {
    let mut base: Map<String, Value> = original
        .as_object()
        .cloned()
        .unwrap_or_default();
    base.remove(field);
    match entry {
        Value::Object(map) => {
            for (k, v) in map {
                base.insert(k, v);
            }
        }
        scalar => {
            base.insert(field.to_string(), scalar);
        }
    }
    Value::Object(base)
}

fn compare_values(a: Option<&Value>, b: Option<&Value>) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match (a, b) {
        (None, None) => Ordering::Equal,
        (None, _) => Ordering::Less,
        (_, None) => Ordering::Greater,
        (Some(x), Some(y)) => match (x, y) {
            (Value::Number(a), Value::Number(b)) => {
                let af = a.as_f64().unwrap_or(0.0);
                let bf = b.as_f64().unwrap_or(0.0);
                af.partial_cmp(&bf).unwrap_or(Ordering::Equal)
            }
            (Value::String(a), Value::String(b)) => a.cmp(b),
            (Value::Bool(a), Value::Bool(b)) => a.cmp(b),
            _ => x.to_string().cmp(&y.to_string()),
        },
    }
}

fn value_to_dedupe_key(v: &Value) -> String {
    // Stable string form — serialise compactly and use as a hash key.
    serde_json::to_string(v).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combine_keeps_sibling_fields() {
        let original = json!({"id": 1, "items": ["a", "b"]});
        let out = combine(&original, "items", json!("a"));
        assert_eq!(out, json!({"id": 1, "items": "a"}));
    }

    #[test]
    fn combine_merges_object_entries() {
        let original = json!({"id": 1, "items": [{"name": "x"}]});
        let out = combine(&original, "items", json!({"name": "x"}));
        assert_eq!(out, json!({"id": 1, "name": "x"}));
    }

    #[test]
    fn compare_numbers() {
        assert_eq!(
            compare_values(Some(&json!(1)), Some(&json!(2))),
            std::cmp::Ordering::Less,
        );
    }

    #[test]
    fn dedupe_key_is_stable() {
        let v = json!({"a": 1, "b": 2});
        assert_eq!(value_to_dedupe_key(&v), value_to_dedupe_key(&v));
    }
}
