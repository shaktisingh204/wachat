//! Compare Datasets node.
//!
//! Compares two upstream datasets by a common key and emits four buckets:
//!   - `matched`   : key exists in both, JSON values identical.
//!   - `different` : key exists in both, JSON values differ (returns `{ a, b }`).
//!   - `onlyInA`   : key only present in dataset A.
//!   - `onlyInB`   : key only present in dataset B.
//!
//! Datasets are pulled by referencing the **name** of two upstream nodes whose
//! outputs are already in `ctx.node_outputs`. This sidesteps the engine's
//! single-input flattening: each Compare Datasets node names the two upstream
//! producers it wants to diff, then keys their first-branch output items by
//! the configured `keyField`.
//!
//! All four buckets are returned as separate branches on the output port
//! (matched, different, onlyInA, onlyInB), and a summary item is also placed
//! on branch 0 alongside `matched` for quick dashboard rendering.

use async_trait::async_trait;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CompareDatasetsNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

/// Return the first-branch items of an upstream node by its block id / name.
fn items_for(ctx: &ExecutionContext, node_name: &str, input: &NodeInput) -> Vec<Value> {
    if node_name.is_empty() {
        return input.items.clone();
    }
    ctx.node_outputs
        .get(node_name)
        .and_then(|out| out.branches.first())
        .map(|b| b.items.clone())
        .unwrap_or_default()
}

/// Pull `keyField` off an item, coercing it to a JSON-stable string.
fn key_for(item: &Value, key_field: &str) -> Option<String> {
    let v = item.get(key_field)?;
    let s = match v {
        Value::Null => return None,
        Value::String(s) => s.clone(),
        other => other.to_string(),
    };
    Some(s)
}

fn fold_by_key(items: Vec<Value>, key_field: &str) -> BTreeMap<String, Value> {
    let mut out: BTreeMap<String, Value> = BTreeMap::new();
    for item in items {
        if let Some(k) = key_for(&item, key_field) {
            out.insert(k, item);
        }
    }
    out
}

#[async_trait]
impl Node for CompareDatasetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "compareDatasets",
            "Compare Datasets",
            "Diff two upstream datasets by a key field",
            NodeCategory::Transform,
        )
        .icon("git-compare")
        .color("#0ea5e9")
        .outputs(4)
        .output_names(&["matched", "different", "onlyInA", "onlyInB"])
        .properties(vec![
            NodeProperty::new("sourceA", "Dataset A (node name)", NodePropertyType::String)
                .placeholder("nodeA")
                .description(
                    "Name of the upstream node whose first-branch output becomes dataset A. \
                     Leave empty to use this node's own merged input.",
                ),
            NodeProperty::new("sourceB", "Dataset B (node name)", NodePropertyType::String)
                .placeholder("nodeB")
                .description("Name of the upstream node whose first-branch output becomes dataset B."),
            NodeProperty::new("keyField", "Key Field", NodePropertyType::String)
                .placeholder("id")
                .default(json!("id"))
                .description("Field name used to pair items between datasets")
                .required(),
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    opt("All Buckets (4 branches)", "all"),
                    opt("Matched Only", "matched"),
                    opt("Different Only", "different"),
                    opt("Only In A", "onlyInA"),
                    opt("Only In B", "onlyInB"),
                ])
                .default(json!("all")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let source_a = ctx.param_str_opt(params, "sourceA").unwrap_or_default();
        let source_b = ctx.param_str_opt(params, "sourceB").unwrap_or_default();
        let key_field = ctx
            .param_str_opt(params, "keyField")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "id".to_string());
        let mode = ctx.param_str_opt(params, "mode").unwrap_or_else(|| "all".into());

        if source_a.is_empty() && source_b.is_empty() {
            return Err(NodeError::InvalidParameter {
                name: "sourceA".into(),
                reason: "at least one of sourceA / sourceB must reference an upstream node".into(),
            });
        }

        let items_a = items_for(ctx, &source_a, &input);
        let items_b = items_for(ctx, &source_b, &input);

        let mut map_a = fold_by_key(items_a, &key_field);
        let mut map_b = fold_by_key(items_b, &key_field);

        let mut matched: Vec<Value> = Vec::new();
        let mut different: Vec<Value> = Vec::new();
        let mut only_a: Vec<Value> = Vec::new();
        let mut only_b: Vec<Value> = Vec::new();

        let keys_a: Vec<String> = map_a.keys().cloned().collect();
        for key in keys_a {
            // Both sides have the key — partition into matched vs different.
            if let Some(b_val) = map_b.remove(&key) {
                let a_val = map_a.remove(&key).unwrap_or(Value::Null);
                if a_val == b_val {
                    matched.push(a_val);
                } else {
                    let mut obj = Map::new();
                    obj.insert(key_field.clone(), Value::String(key));
                    obj.insert("a".into(), a_val);
                    obj.insert("b".into(), b_val);
                    different.push(Value::Object(obj));
                }
            } else {
                // Only in A.
                if let Some(a_val) = map_a.remove(&key) {
                    only_a.push(a_val);
                }
            }
        }
        // Anything still in map_b is only-in-B.
        for (_k, v) in map_b.into_iter() {
            only_b.push(v);
        }

        let summary = json!({
            "summary": {
                "matched": matched.len(),
                "different": different.len(),
                "onlyInA": only_a.len(),
                "onlyInB": only_b.len(),
                "keyField": key_field,
            }
        });

        match mode.as_str() {
            "matched" => Ok(NodeOutput::single(matched)),
            "different" => Ok(NodeOutput::single(different)),
            "onlyInA" => Ok(NodeOutput::single(only_a)),
            "onlyInB" => Ok(NodeOutput::single(only_b)),
            _ => {
                // Branch 0 gets matched items plus a leading summary record.
                let mut branch0 = Vec::with_capacity(matched.len() + 1);
                branch0.push(summary);
                branch0.extend(matched);
                Ok(NodeOutput::multi(vec![branch0, different, only_a, only_b]))
            }
        }
    }
}
