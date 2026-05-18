//! Compare Datasets node — diff upstream items into add/remove/update sets.
//!
//! Mirrors n8n's `compareDatasets` node: takes a flat list of items (the
//! engine flattens both upstream branches into `input.items`), splits them by
//! a discriminator field (`leftSourceField` / `rightSourceField`), and joins
//! the two halves by `keyField`.
//!
//! Emits four output branches in this order:
//!   1. `added`     — keys present on the right but not the left.
//!   2. `removed`   — keys present on the left but not the right.
//!   3. `changed`   — keys present on both with a different shape.
//!   4. `unchanged` — keys present on both with the same shape.
//!
//! Items without a `keyField` value are dropped from comparison so they don't
//! collapse into a single "" bucket.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};
use std::collections::HashMap;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CompareDatasetsNode;

#[async_trait]
impl Node for CompareDatasetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "compareDatasets",
            "Compare Datasets",
            "Diff two datasets keyed by a common field",
            NodeCategory::Transform,
        )
        .icon("scale")
        .color("#a855f7")
        .outputs(4)
        .output_names(&["added", "removed", "changed", "unchanged"])
        .properties(vec![
            NodeProperty::new("keyField", "Key Field", NodePropertyType::String)
                .description("Field used to pair items across the two datasets")
                .placeholder("id")
                .required(),
            NodeProperty::new("sourceField", "Source Marker Field", NodePropertyType::String)
                .description(
                    "Field on each item that identifies which dataset it came from",
                )
                .placeholder("source"),
            NodeProperty::new("leftSourceValue", "Left Value", NodePropertyType::String)
                .description("`sourceField` value that marks dataset A")
                .placeholder("left"),
            NodeProperty::new("rightSourceValue", "Right Value", NodePropertyType::String)
                .description("`sourceField` value that marks dataset B")
                .placeholder("right"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let key_field = ctx.param_str(params, "keyField")?;
        if key_field.is_empty() {
            return Err(NodeError::MissingParameter("keyField".into()));
        }
        let source_field = ctx
            .param_str_opt(params, "sourceField")
            .filter(|s| !s.is_empty());
        let left_value = ctx
            .param_str_opt(params, "leftSourceValue")
            .filter(|s| !s.is_empty());
        let right_value = ctx
            .param_str_opt(params, "rightSourceValue")
            .filter(|s| !s.is_empty());

        // Bucket each item into left/right.  Two routing strategies:
        //  - If `sourceField` is set, use that field's value (compared against
        //    `leftValue` / `rightValue`).
        //  - Otherwise, split the input list in half (first half = left,
        //    second half = right). Useful when upstream branches arrive
        //    already partitioned.
        let mut lefts: HashMap<String, Value> = HashMap::new();
        let mut rights: HashMap<String, Value> = HashMap::new();

        if let Some(field) = source_field.as_ref() {
            for item in input.items.into_iter() {
                let bucket = item.get(field).and_then(|v| v.as_str()).map(|s| s.to_string());
                let key = item.get(&key_field).map(stringify_key);

                let Some(key) = key else { continue };

                match bucket.as_deref() {
                    Some(b) if Some(b) == left_value.as_deref() => {
                        lefts.insert(key, item);
                    }
                    Some(b) if Some(b) == right_value.as_deref() => {
                        rights.insert(key, item);
                    }
                    // No explicit match — try a sensible fallback when only
                    // one side is configured.
                    Some(_) | None => {
                        if right_value.is_none() {
                            rights.insert(key, item);
                        } else if left_value.is_none() {
                            lefts.insert(key, item);
                        }
                    }
                }
            }
        } else {
            let items = input.items;
            let half = items.len() / 2;
            for (idx, item) in items.into_iter().enumerate() {
                let key = item.get(&key_field).map(stringify_key);
                let Some(key) = key else { continue };
                if idx < half {
                    lefts.insert(key, item);
                } else {
                    rights.insert(key, item);
                }
            }
        }

        let mut added: Vec<Value> = Vec::new();
        let mut removed: Vec<Value> = Vec::new();
        let mut changed: Vec<Value> = Vec::new();
        let mut unchanged: Vec<Value> = Vec::new();

        // Walk right side: matched → unchanged/changed, unmatched → added.
        for (key, right_item) in rights.iter() {
            match lefts.get(key) {
                Some(left_item) => {
                    if items_equivalent(left_item, right_item) {
                        unchanged.push(right_item.clone());
                    } else {
                        let mut diff = Map::new();
                        diff.insert("key".into(), Value::String(key.clone()));
                        diff.insert("left".into(), left_item.clone());
                        diff.insert("right".into(), right_item.clone());
                        diff.insert(
                            "changedFields".into(),
                            Value::Array(diff_fields(left_item, right_item)),
                        );
                        changed.push(Value::Object(diff));
                    }
                }
                None => added.push(right_item.clone()),
            }
        }

        // Walk left side for removed.
        for (key, left_item) in lefts.iter() {
            if !rights.contains_key(key) {
                removed.push(left_item.clone());
            }
        }

        // Stable-ish ordering — sort by key for deterministic output.
        sort_by_key(&mut added, &key_field);
        sort_by_key(&mut removed, &key_field);
        changed.sort_by_key(|v| {
            v.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string()
        });
        sort_by_key(&mut unchanged, &key_field);

        Ok(NodeOutput::multi(vec![added, removed, changed, unchanged]))
    }
}

fn stringify_key(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn items_equivalent(a: &Value, b: &Value) -> bool {
    // Comparing via canonicalised JSON: sort keys, then string-compare.
    canonicalize(a) == canonicalize(b)
}

fn canonicalize(v: &Value) -> String {
    match v {
        Value::Object(map) => {
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by(|a, b| a.0.cmp(b.0));
            let inner: Vec<String> = entries
                .into_iter()
                .map(|(k, v)| format!("{k:?}:{}", canonicalize(v)))
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        Value::Array(arr) => {
            let inner: Vec<String> = arr.iter().map(canonicalize).collect();
            format!("[{}]", inner.join(","))
        }
        other => other.to_string(),
    }
}

fn diff_fields(a: &Value, b: &Value) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    let empty = Map::new();
    let a_obj = a.as_object().unwrap_or(&empty);
    let b_obj = b.as_object().unwrap_or(&empty);
    let mut keys: Vec<&String> = a_obj.keys().chain(b_obj.keys()).collect();
    keys.sort();
    keys.dedup();
    for k in keys {
        let av = a_obj.get(k);
        let bv = b_obj.get(k);
        if av != bv {
            out.push(Value::String(k.clone()));
        }
    }
    out
}

fn sort_by_key(items: &mut [Value], key_field: &str) {
    items.sort_by_key(|v| {
        v.get(key_field).map(stringify_key).unwrap_or_default()
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalize_is_key_order_independent() {
        let a = json!({"b": 1, "a": 2});
        let b = json!({"a": 2, "b": 1});
        assert_eq!(canonicalize(&a), canonicalize(&b));
    }

    #[test]
    fn diff_fields_reports_changed_keys() {
        let a = json!({"name": "Alice", "age": 30});
        let b = json!({"name": "Alice", "age": 31});
        let d = diff_fields(&a, &b);
        assert_eq!(d, vec![Value::String("age".into())]);
    }

    #[test]
    fn items_equivalent_handles_object_order() {
        assert!(items_equivalent(
            &json!({"a": 1, "b": 2}),
            &json!({"b": 2, "a": 1})
        ));
        assert!(!items_equivalent(
            &json!({"a": 1, "b": 2}),
            &json!({"a": 1, "b": 3})
        ));
    }
}
