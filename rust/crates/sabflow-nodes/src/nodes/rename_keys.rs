//! Rename Keys node — rename top-level object keys on each item.
//!
//! Mirrors n8n's `n8n-nodes-base.renameKeys`. The `keys` parameter is a
//! collection of `{ currentKey, newKey }` pairs. Renaming preserves insertion
//! order using `serde_json::Map` (BTreeMap-backed by default, but with
//! `preserve_order` feature `IndexMap` — either way, the rebuild walks the
//! source in order so output is stable for downstream nodes that care).
//!
//! Pure local computation; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct RenameKeysNode;

#[async_trait]
impl Node for RenameKeysNode {
    fn descriptor(&self) -> NodeDescriptor {
        let key_children = vec![
            NodeProperty::new("currentKey", "Current Key", NodePropertyType::String)
                .placeholder("oldName")
                .required(),
            NodeProperty::new("newKey", "New Key", NodePropertyType::String)
                .placeholder("newName")
                .required(),
        ];

        let mut keys_prop =
            NodeProperty::new("keys", "Keys to Rename", NodePropertyType::Collection)
                .description("Pairs of (current key, new key) to apply to every item");
        keys_prop.children = key_children;

        NodeDescriptor::new(
            "renameKeys",
            "Rename Keys",
            "Rename top-level object keys on each item",
            NodeCategory::Transform,
        )
        .icon("edit")
        .color("#0ea5e9")
        .properties(vec![
            keys_prop,
            NodeProperty::new("keepUnmatched", "Keep Unmatched Keys", NodePropertyType::Boolean)
                .description("Keep keys that aren't in the rename list (otherwise drop them)")
                .default(json!(true)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let keep_unmatched = ctx.param_bool(params, "keepUnmatched", true);

        let pairs: Vec<(String, String)> = params
            .get("keys")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|entry| {
                        let current = entry.get("currentKey").and_then(|v| v.as_str())?;
                        let new_key = entry.get("newKey").and_then(|v| v.as_str())?;
                        if current.is_empty() || new_key.is_empty() {
                            return None;
                        }
                        Some((current.to_string(), new_key.to_string()))
                    })
                    .collect()
            })
            .unwrap_or_default();

        let mut out_items: Vec<Value> = Vec::with_capacity(input.items.len());
        for item in input.items.into_iter() {
            match item {
                Value::Object(map) => {
                    let mut new_map = Map::new();
                    for (k, v) in map.into_iter() {
                        if let Some((_, new_key)) = pairs.iter().find(|(cur, _)| cur == &k) {
                            new_map.insert(new_key.clone(), v);
                        } else if keep_unmatched {
                            new_map.insert(k, v);
                        }
                    }
                    out_items.push(Value::Object(new_map));
                }
                other => out_items.push(other),
            }
        }

        Ok(NodeOutput::single(out_items))
    }
}
