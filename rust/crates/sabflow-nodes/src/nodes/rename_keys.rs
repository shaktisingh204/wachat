//! Rename Keys node.
//!
//! For every incoming item, rewrites top-level object keys according to a
//! list of `{ from, to }` mappings.  Non-object items are passed through
//! untouched.  Mappings with empty `from` or `to` strings are silently
//! ignored.  When two mappings collide on the same target key, the **last**
//! mapping wins (so users can override earlier entries explicitly).
//!
//! Optional flags:
//!   - `caseInsensitive` : matches `from` against keys case-insensitively.
//!   - `keepUnmapped`    : when false, only the renamed keys survive — every
//!                         other field on the source item is dropped.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct RenameKeysNode;

#[derive(Debug, Clone)]
struct Rename {
    from: String,
    to: String,
}

fn extract_pairs(params: &Value) -> Vec<Rename> {
    let raw = match params.get("keys") {
        Some(Value::Array(arr)) => arr.clone(),
        Some(Value::Object(map)) => vec![Value::Object(map.clone())],
        _ => return vec![],
    };
    raw.into_iter()
        .filter_map(|entry| {
            let from = entry
                .get("from")
                .or_else(|| entry.get("currentKey"))
                .or_else(|| entry.get("oldKey"))
                .and_then(|v| v.as_str())?
                .to_string();
            let to = entry
                .get("to")
                .or_else(|| entry.get("newKey"))
                .and_then(|v| v.as_str())?
                .to_string();
            if from.is_empty() || to.is_empty() {
                return None;
            }
            Some(Rename { from, to })
        })
        .collect()
}

fn rewrite_object(
    obj: Map<String, Value>,
    pairs: &[Rename],
    case_insensitive: bool,
    keep_unmapped: bool,
) -> Map<String, Value> {
    if pairs.is_empty() {
        return obj;
    }
    let mut out: Map<String, Value> = Map::new();

    // First, optionally copy through unmapped keys. We need to know which
    // source keys participate as a `from` so we can suppress them when
    // keep_unmapped=false. With case_insensitive, the match is on lower-case
    // comparison.
    let from_set: Vec<String> = pairs
        .iter()
        .map(|p| {
            if case_insensitive {
                p.from.to_ascii_lowercase()
            } else {
                p.from.clone()
            }
        })
        .collect();

    if keep_unmapped {
        for (k, v) in obj.iter() {
            let needle = if case_insensitive {
                k.to_ascii_lowercase()
            } else {
                k.clone()
            };
            if !from_set.iter().any(|f| *f == needle) {
                out.insert(k.clone(), v.clone());
            }
        }
    }

    // Apply renames in declared order. Last writer wins on `to` collisions.
    for pair in pairs {
        let needle = if case_insensitive {
            pair.from.to_ascii_lowercase()
        } else {
            pair.from.clone()
        };
        // Find the matching source key in `obj`.
        let source_key = obj.keys().find(|k| {
            if case_insensitive {
                k.to_ascii_lowercase() == needle
            } else {
                **k == needle
            }
        });
        if let Some(src) = source_key {
            if let Some(v) = obj.get(src) {
                out.insert(pair.to.clone(), v.clone());
            }
        }
    }

    out
}

#[async_trait]
impl Node for RenameKeysNode {
    fn descriptor(&self) -> NodeDescriptor {
        let key_children = vec![
            NodeProperty::new("from", "Current Key", NodePropertyType::String)
                .placeholder("oldName")
                .required(),
            NodeProperty::new("to", "New Key", NodePropertyType::String)
                .placeholder("newName")
                .required(),
        ];

        let mut keys_prop = NodeProperty::new("keys", "Renames", NodePropertyType::Collection)
            .description("Pairs of { from, to } describing each rename");
        keys_prop.children = key_children;

        NodeDescriptor::new(
            "renameKeys",
            "Rename Keys",
            "Rename top-level keys on each item",
            NodeCategory::Transform,
        )
        .icon("text-cursor-input")
        .color("#0ea5e9")
        .properties(vec![
            keys_prop,
            NodeProperty::new(
                "caseInsensitive",
                "Case Insensitive",
                NodePropertyType::Boolean,
            )
            .description("Match source keys regardless of casing")
            .default(json!(false)),
            NodeProperty::new("keepUnmapped", "Keep Unmapped Keys", NodePropertyType::Boolean)
                .description("If false, only the renamed keys survive in the output")
                .default(json!(true)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let pairs = extract_pairs(params);
        let case_insensitive = ctx.param_bool(params, "caseInsensitive", false);
        let keep_unmapped = ctx.param_bool(params, "keepUnmapped", true);

        if pairs.is_empty() {
            // No-op: pass items through untouched so misconfigured nodes don't
            // silently nuke their input.
            return Ok(NodeOutput::single(input.items));
        }

        let mut out: Vec<Value> = Vec::with_capacity(input.items.len());
        for item in input.items.into_iter() {
            match item {
                Value::Object(map) => {
                    let rewritten = rewrite_object(map, &pairs, case_insensitive, keep_unmapped);
                    out.push(Value::Object(rewritten));
                }
                other => out.push(other),
            }
        }
        Ok(NodeOutput::single(out))
    }
}
