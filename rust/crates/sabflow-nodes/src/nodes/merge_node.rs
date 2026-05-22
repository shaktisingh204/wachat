//! Merge node — n8n parity (`n8n-nodes-base.merge`).
//!
//! Fan-in of N input branches. The engine flattens every upstream branch
//! into `input.items` before calling this node, but preserves the original
//! branch index of each item under `pairedItem.input` so this node can
//! recover the per-branch buckets. The mirror of n8n's
//! `IPairedItemData` (see `src/lib/sabflow/n8n/interfaces.ts:1393`) — every
//! emitted item carries a `pairedItem` field pointing back at its source.
//!
//! ## Modes
//!
//! * `append`           — concatenate all branches in order (n8n's default).
//! * `mergeByPosition`  — walk every branch in lock-step; emit one item per
//!   index that merges fields across all branches. Padding behaviour
//!   matches n8n: shorter branches contribute nothing past their own length.
//! * `mergeByKey`       — outer-join all branches on a shared field name.
//!   Items missing from later branches keep their existing fields only.
//! * `multiplex`        — Cartesian product across branches; output size is
//!   `prod(len(branch_i))`. Each emitted item is a shallow-merge of one
//!   pick from every branch.
//!
//! All four modes preserve / synthesise the `pairedItem` field so lineage
//! propagation through the editor stays intact.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct MergeNode;

fn opt(name: &str, value: &str, desc: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: Value::String(value.to_string()),
        description: Some(desc.to_string()),
    }
}

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
                    opt("Append", "append", "Concatenate items from every input"),
                    opt(
                        "Merge By Position",
                        "mergeByPosition",
                        "Walk branches in lock-step and merge fields per index",
                    ),
                    opt(
                        "Merge By Key",
                        "mergeByKey",
                        "Outer-join items that share a field value",
                    ),
                    opt(
                        "Multiplex",
                        "multiplex",
                        "Cartesian product across all branches",
                    ),
                ])
                .default(Value::String("append".into()))
                .required(),
            NodeProperty::new("mergeByField", "Merge By Field", NodePropertyType::String)
                .placeholder("id")
                .show_when("mode", &["mergeByKey"])
                .description("Field name used to outer-join items across branches."),
            NodeProperty::new(
                "includeUnpaired",
                "Include Unpaired Items",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false))
            .show_when("mode", &["mergeByKey"])
            .description(
                "When on, items that don't match any partner branch still appear in \
                     the output (left-outer-join semantics).",
            ),
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

        // Recover the per-branch shape from the flattened items list using
        // each item's `pairedItem.input` annotation. Items without an
        // annotation fall into branch 0 — the n8n default.
        let branches = group_by_input(input.items);

        match mode.as_str() {
            "append" => Ok(NodeOutput::single(merge_branches(branches))),

            "mergeByPosition" => {
                let merged = merge_by_position(branches);
                Ok(NodeOutput::single(merged))
            }

            "mergeByKey" => {
                let field = ctx
                    .param_str_opt(params, "mergeByField")
                    .unwrap_or_default();
                let include_unpaired = ctx.param_bool(params, "includeUnpaired", false);
                if field.is_empty() {
                    return Err(NodeError::MissingParameter("mergeByField".into()));
                }
                Ok(NodeOutput::single(merge_by_key(
                    branches,
                    &field,
                    include_unpaired,
                )))
            }

            "multiplex" => Ok(NodeOutput::single(multiplex(branches))),

            other => Err(NodeError::InvalidParameter {
                name: "mode".into(),
                reason: format!("unknown merge mode: {other}"),
            }),
        }
    }
}

// ─── Branch reconstruction ───────────────────────────────────────────────────

/// Pull the `pairedItem.input` index off each item to rebuild the per-branch
/// buckets the user wired into the node. Items without the annotation default
/// to branch 0 (matches n8n's implicit single-branch fallback). The relative
/// order inside each branch is preserved.
fn group_by_input(items: Vec<Value>) -> Vec<Vec<Value>> {
    let mut buckets: Vec<Vec<Value>> = Vec::new();
    for item in items {
        let idx = read_paired_input(&item).unwrap_or(0);
        if idx >= buckets.len() {
            buckets.resize_with(idx + 1, Vec::new);
        }
        buckets[idx].push(item);
    }
    if buckets.is_empty() {
        buckets.push(Vec::new());
    }
    buckets
}

fn read_paired_input(item: &Value) -> Option<usize> {
    let paired = item.get("pairedItem")?;
    match paired {
        Value::Object(m) => m.get("input").and_then(|v| v.as_u64()).map(|x| x as usize),
        Value::Array(arr) => arr
            .first()
            .and_then(|p| p.get("input").and_then(|v| v.as_u64()))
            .map(|x| x as usize),
        _ => None,
    }
}

fn read_paired_item_idx(item: &Value) -> Option<usize> {
    let paired = item.get("pairedItem")?;
    match paired {
        Value::Object(m) => m.get("item").and_then(|v| v.as_u64()).map(|x| x as usize),
        Value::Number(n) => n.as_u64().map(|x| x as usize),
        Value::Array(arr) => arr
            .first()
            .and_then(|p| p.get("item").and_then(|v| v.as_u64()))
            .map(|x| x as usize),
        _ => None,
    }
}

// ─── Mode: append (merge_branches) ───────────────────────────────────────────

/// N-input fan-in: concatenate all branches and rewrite each item's
/// `pairedItem` so the merged stream's lineage tracks the source branch.
/// Mirrors the `merge_branches` helper slated for the SabFlow node SDK.
fn merge_branches(branches: Vec<Vec<Value>>) -> Vec<Value> {
    let total: usize = branches.iter().map(|b| b.len()).sum();
    let mut out = Vec::with_capacity(total);
    for (branch_idx, items) in branches.into_iter().enumerate() {
        for (item_idx, item) in items.into_iter().enumerate() {
            out.push(rewrite_paired_input(item, branch_idx, item_idx));
        }
    }
    out
}

// ─── Mode: mergeByPosition ───────────────────────────────────────────────────

fn merge_by_position(branches: Vec<Vec<Value>>) -> Vec<Value> {
    let n = branches.iter().map(|b| b.len()).max().unwrap_or(0);
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let mut obj = Map::new();
        let mut pairing: Vec<Value> = Vec::new();
        for (branch_idx, branch) in branches.iter().enumerate() {
            if let Some(item) = branch.get(i) {
                if let Some(map) = item.as_object() {
                    for (k, v) in map.iter() {
                        if k.as_str() == "pairedItem" {
                            continue;
                        }
                        obj.insert(k.clone(), v.clone());
                    }
                } else {
                    obj.insert("value".to_string(), item.clone());
                }
                pairing.push(json!({ "item": i, "input": branch_idx }));
            }
        }
        obj.insert("pairedItem".to_string(), Value::Array(pairing));
        out.push(Value::Object(obj));
    }
    out
}

// ─── Mode: mergeByKey ────────────────────────────────────────────────────────

fn merge_by_key(branches: Vec<Vec<Value>>, field: &str, include_unpaired: bool) -> Vec<Value> {
    // The left branch (branch 0) is the seed; later branches contribute
    // matching items by `field`. Items missing from later branches appear
    // in the output only when `include_unpaired` is true.
    if branches.is_empty() {
        return Vec::new();
    }
    let left = &branches[0];
    let rest = &branches[1..];

    let mut out: Vec<Value> = Vec::with_capacity(left.len());
    for (i, left_item) in left.iter().enumerate() {
        let key = left_item.get(field).cloned();
        let mut obj: Map<String, Value> = match left_item {
            Value::Object(m) => m
                .iter()
                .filter(|(k, _)| k.as_str() != "pairedItem")
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect(),
            other => {
                let mut m = Map::new();
                m.insert("value".to_string(), other.clone());
                m
            }
        };
        let mut pairing: Vec<Value> = vec![json!({ "item": i, "input": 0 })];
        let mut any_match = false;
        if let Some(key_val) = key.as_ref().filter(|k| !k.is_null()) {
            for (branch_offset, branch) in rest.iter().enumerate() {
                let branch_idx = branch_offset + 1;
                if let Some((j, partner)) = branch
                    .iter()
                    .enumerate()
                    .find(|(_, it)| it.get(field) == Some(key_val))
                {
                    any_match = true;
                    if let Some(map) = partner.as_object() {
                        for (k, v) in map.iter() {
                            if k.as_str() == "pairedItem" {
                                continue;
                            }
                            obj.insert(k.clone(), v.clone());
                        }
                    }
                    pairing.push(json!({ "item": j, "input": branch_idx }));
                }
            }
        }
        if any_match || include_unpaired {
            obj.insert("pairedItem".to_string(), Value::Array(pairing));
            out.push(Value::Object(obj));
        }
    }
    out
}

// ─── Mode: multiplex ─────────────────────────────────────────────────────────

fn multiplex(branches: Vec<Vec<Value>>) -> Vec<Value> {
    if branches.is_empty() {
        return Vec::new();
    }
    if branches.iter().any(|b| b.is_empty()) {
        return Vec::new();
    }
    // Build the cartesian product by walking an index vector and incrementing
    // it like a mixed-radix counter.
    let mut idx: Vec<usize> = vec![0; branches.len()];
    let total: usize = branches.iter().map(|b| b.len()).product();
    let mut out = Vec::with_capacity(total);
    for _ in 0..total {
        let mut obj = Map::new();
        let mut pairing: Vec<Value> = Vec::with_capacity(branches.len());
        for (branch_idx, branch) in branches.iter().enumerate() {
            let item = &branch[idx[branch_idx]];
            if let Some(map) = item.as_object() {
                for (k, v) in map.iter() {
                    if k.as_str() == "pairedItem" {
                        continue;
                    }
                    obj.insert(k.clone(), v.clone());
                }
            } else {
                obj.insert("value".to_string(), item.clone());
            }
            pairing.push(json!({ "item": idx[branch_idx], "input": branch_idx }));
        }
        obj.insert("pairedItem".to_string(), Value::Array(pairing));
        out.push(Value::Object(obj));

        // Increment the mixed-radix counter.
        for k in (0..branches.len()).rev() {
            idx[k] += 1;
            if idx[k] < branches[k].len() {
                break;
            }
            idx[k] = 0;
        }
    }
    out
}

// ─── pairedItem rewrite ──────────────────────────────────────────────────────

fn rewrite_paired_input(item: Value, branch_idx: usize, item_idx: usize) -> Value {
    // Preserve the original `item` index when present so deeper lineage
    // survives the merge (matches n8n's behaviour where IPairedItemData is
    // updated in place, not replaced).
    let original_item_idx = read_paired_item_idx(&item).unwrap_or(item_idx);
    let mut wrapped = match item {
        Value::Object(_) => item,
        other => {
            let mut m = Map::new();
            m.insert("value".to_string(), other);
            Value::Object(m)
        }
    };
    if let Some(obj) = wrapped.as_object_mut() {
        obj.insert(
            "pairedItem".to_string(),
            json!({ "item": original_item_idx, "input": branch_idx }),
        );
    }
    wrapped
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".into(),
            Arc::new(reqwest::Client::builder().build().unwrap()),
        )
    }

    fn tagged(branch: usize, item: usize, json_obj: Value) -> Value {
        let mut m = json_obj.as_object().cloned().unwrap_or_default();
        m.insert(
            "pairedItem".to_string(),
            json!({ "item": item, "input": branch }),
        );
        Value::Object(m)
    }

    #[tokio::test]
    async fn append_concatenates_and_rewrites_lineage() {
        let mut c = ctx();
        let input = NodeInput::many(vec![
            tagged(0, 0, json!({"a": 1})),
            tagged(1, 0, json!({"b": 2})),
            tagged(1, 1, json!({"b": 3})),
        ]);
        let params = json!({ "mode": "append" });
        let out = MergeNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches.len(), 1);
        let items = &out.branches[0].items;
        assert_eq!(items.len(), 3);
        // Item from branch 1 keeps `input: 1`.
        assert_eq!(
            items[1].get("pairedItem").unwrap(),
            &json!({ "item": 0, "input": 1 })
        );
    }

    #[tokio::test]
    async fn merge_by_position_zips_lockstep() {
        let mut c = ctx();
        let input = NodeInput::many(vec![
            tagged(0, 0, json!({"a": "a0"})),
            tagged(0, 1, json!({"a": "a1"})),
            tagged(1, 0, json!({"b": "b0"})),
            tagged(1, 1, json!({"b": "b1"})),
        ]);
        let params = json!({ "mode": "mergeByPosition" });
        let out = MergeNode.execute(&mut c, input, &params).await.unwrap();
        let items = &out.branches[0].items;
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].get("a").and_then(|v| v.as_str()), Some("a0"));
        assert_eq!(items[0].get("b").and_then(|v| v.as_str()), Some("b0"));
    }

    #[tokio::test]
    async fn merge_by_key_joins_on_field() {
        let mut c = ctx();
        let input = NodeInput::many(vec![
            tagged(0, 0, json!({"id": 1, "name": "alice"})),
            tagged(0, 1, json!({"id": 2, "name": "bob"})),
            tagged(1, 0, json!({"id": 2, "score": 99})),
            tagged(1, 1, json!({"id": 1, "score": 42})),
        ]);
        let params = json!({
            "mode": "mergeByKey",
            "mergeByField": "id",
            "includeUnpaired": false,
        });
        let out = MergeNode.execute(&mut c, input, &params).await.unwrap();
        let items = &out.branches[0].items;
        assert_eq!(items.len(), 2);
        // alice (id=1) gets score=42 from branch 1
        assert_eq!(items[0].get("name").and_then(|v| v.as_str()), Some("alice"));
        assert_eq!(items[0].get("score").and_then(|v| v.as_i64()), Some(42));
        // bob (id=2) gets score=99 from branch 1
        assert_eq!(items[1].get("name").and_then(|v| v.as_str()), Some("bob"));
        assert_eq!(items[1].get("score").and_then(|v| v.as_i64()), Some(99));
    }

    #[tokio::test]
    async fn merge_by_key_requires_field() {
        let mut c = ctx();
        let input = NodeInput::many(vec![tagged(0, 0, json!({"id": 1}))]);
        let params = json!({ "mode": "mergeByKey" });
        let err = MergeNode.execute(&mut c, input, &params).await.unwrap_err();
        assert!(matches!(err, NodeError::MissingParameter(ref p) if p == "mergeByField"));
    }

    #[tokio::test]
    async fn multiplex_is_cartesian() {
        let mut c = ctx();
        let input = NodeInput::many(vec![
            tagged(0, 0, json!({"a": 1})),
            tagged(0, 1, json!({"a": 2})),
            tagged(1, 0, json!({"b": 10})),
            tagged(1, 1, json!({"b": 20})),
            tagged(1, 2, json!({"b": 30})),
        ]);
        let params = json!({ "mode": "multiplex" });
        let out = MergeNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 6);
    }

    #[tokio::test]
    async fn unknown_mode_returns_invalid_parameter() {
        let mut c = ctx();
        let input = NodeInput::many(vec![]);
        let params = json!({ "mode": "fancy" });
        let err = MergeNode.execute(&mut c, input, &params).await.unwrap_err();
        assert!(matches!(err, NodeError::InvalidParameter { ref name, .. } if name == "mode"));
    }
}
