//! Split Out node — `n8n-nodes-base.splitOut`.
//!
//! Inverse of [`super::aggregate::AggregateNode`]: for every input item, fan
//! out one output item per element of the configured array field(s).
//! Mirrors n8n's ItemLists-V2 → Split-Out variant (later promoted to its own
//! node type).
//!
//! Modes (driven by `include`):
//!
//! * **`noOtherFields`** — emit only the split element value, keyed by the
//!   target field name (or the `destinationFieldName` override).  When the
//!   element is itself an object it is emitted as-is.
//! * **`allOtherFields`** *(default)* — copy every sibling key from the
//!   parent item alongside the split value.
//! * **`selectedOtherFields`** — copy only the comma-separated key list.
//!
//! Multiple fields may be split at once by giving `fieldToSplitOut` a
//! comma-separated value, matching n8n behaviour (n8n zips when each is the
//! same length and warns otherwise — we follow the same "longest wins"
//! policy with `null`-padding for shorter sources).
//!
//! Each emitted item carries a `pairedItem: { item: i }` field where `i` is
//! the index of the upstream item it came from, preserving lineage.
//!
//! Forge port: `src/lib/sabflow/forge/blocks/n8n/transform/split_out.ts`.
//! n8n reference: `n8n-master/packages/nodes-base/nodes/Transform/SplitOut/SplitOut.node.ts`.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SplitOutNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SplitOutNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "splitOut",
            "Split Out",
            "Fan out an array field into one item per entry",
            NodeCategory::Transform,
        )
        .icon("split")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new(
                "fieldToSplitOut",
                "Field To Split Out",
                NodePropertyType::String,
            )
            .placeholder("data.results")
            .description("Dotted path of the array field. Comma-separate to split several at once.")
            .required(),
            NodeProperty::new("include", "Include", NodePropertyType::Options)
                .options(vec![
                    opt("No Other Fields", "noOtherFields"),
                    opt("All Other Fields", "allOtherFields"),
                    opt("Selected Other Fields", "selectedOtherFields"),
                ])
                .default(json!("allOtherFields"))
                .description("How to handle the sibling fields on each input item"),
            NodeProperty::new(
                "fieldsToInclude",
                "Fields To Include",
                NodePropertyType::String,
            )
            .placeholder("id, name")
            .description("Comma-separated list of sibling fields to keep")
            .show_when("include", &["selectedOtherFields"]),
            NodeProperty::new(
                "destinationFieldName",
                "Destination Field Name",
                NodePropertyType::String,
            )
            .description(
                "Optional name to give the split element under. Defaults to the source field's last segment.",
            ),
            NodeProperty::new(
                "disableDotNotation",
                "Disable Dot Notation",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("If true, field names containing dots are treated literally"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let raw_fields = ctx.param_str(params, "fieldToSplitOut")?;
        let fields: Vec<String> = raw_fields
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if fields.is_empty() {
            return Err(NodeError::MissingParameter("fieldToSplitOut".into()));
        }

        let include = ctx
            .param_str_opt(params, "include")
            .unwrap_or_else(|| "allOtherFields".to_string());
        let fields_to_include = ctx.param_str_opt(params, "fieldsToInclude").unwrap_or_default();
        let include_keep_list: Vec<String> = fields_to_include
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let dest_override = ctx
            .param_str_opt(params, "destinationFieldName")
            .filter(|s| !s.is_empty());
        let disable_dot = ctx.param_bool(params, "disableDotNotation", false);

        let mut out_items: Vec<Value> = Vec::new();

        for (item_idx, item) in input.items.iter().enumerate() {
            let Value::Object(obj) = item else {
                // Non-object items can't have a field to split — emit them as-is.
                let mut wrapped = Map::new();
                wrapped.insert("value".into(), item.clone());
                wrapped.insert("pairedItem".into(), json!({ "item": item_idx }));
                out_items.push(Value::Object(wrapped));
                continue;
            };

            // Resolve each requested field path to its (possibly array) value.
            let mut columns: Vec<(String, Vec<Value>)> = Vec::with_capacity(fields.len());
            for path in fields.iter() {
                let v = if disable_dot {
                    obj.get(path.as_str()).cloned().unwrap_or(Value::Null)
                } else {
                    lookup_path(item, path).cloned().unwrap_or(Value::Null)
                };
                let arr = match v {
                    Value::Array(a) => a,
                    Value::Null => Vec::new(),
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "fieldToSplitOut".into(),
                            reason: format!(
                                "field '{}' on item #{} is not an array (got {})",
                                path,
                                item_idx,
                                value_type_name(&other)
                            ),
                        });
                    }
                };
                let col_name = dest_override
                    .clone()
                    .unwrap_or_else(|| last_segment(path).to_string());
                columns.push((col_name, arr));
            }

            // Base record carrying the sibling fields (per `include`).
            let base = build_carryover(obj, &include, &include_keep_list, &fields, disable_dot);

            let max_len = columns.iter().map(|(_, a)| a.len()).max().unwrap_or(0);
            if max_len == 0 {
                // n8n quirk: empty array → no output for that item.
                continue;
            }

            for row in 0..max_len {
                let mut out_obj = base.clone();
                for (col_name, arr) in columns.iter() {
                    let v = arr.get(row).cloned().unwrap_or(Value::Null);
                    // If the element is itself an object AND only one split column is requested,
                    // merge its keys instead of nesting — matches n8n's "object element" behaviour.
                    if columns.len() == 1 {
                        match v {
                            Value::Object(inner) => {
                                for (k, val) in inner.into_iter() {
                                    out_obj.insert(k, val);
                                }
                            }
                            other => {
                                out_obj.insert(col_name.clone(), other);
                            }
                        }
                    } else {
                        out_obj.insert(col_name.clone(), v);
                    }
                }
                out_obj.insert("pairedItem".into(), json!({ "item": item_idx }));
                out_items.push(Value::Object(out_obj));
            }
        }

        Ok(NodeOutput::single(out_items))
    }
}

/// Build the per-row "carry-over" object holding sibling fields the user
/// asked to keep alongside the split element.
fn build_carryover(
    obj: &Map<String, Value>,
    include: &str,
    keep: &[String],
    splits: &[String],
    disable_dot: bool,
) -> Map<String, Value> {
    match include {
        "noOtherFields" => Map::new(),
        "allOtherFields" => {
            let split_roots: Vec<&str> = splits
                .iter()
                .map(|s| {
                    if disable_dot {
                        s.as_str()
                    } else {
                        s.split('.').next().unwrap_or(s)
                    }
                })
                .collect();
            obj.iter()
                .filter(|(k, _)| !split_roots.iter().any(|r| *r == k.as_str()))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        }
        "selectedOtherFields" => obj
            .iter()
            .filter(|(k, _)| keep.iter().any(|name| name.as_str() == k.as_str()))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
        _ => Map::new(),
    }
}

fn last_segment(path: &str) -> &str {
    path.rsplit('.').next().unwrap_or(path)
}

fn lookup_path<'a>(v: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(v);
    }
    let mut cur = v;
    for part in path.split('.') {
        cur = cur.get(part)?;
    }
    Some(cur)
}

fn value_type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
