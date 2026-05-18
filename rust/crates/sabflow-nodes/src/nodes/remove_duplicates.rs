//! RemoveDuplicates node — `n8n-nodes-base.removeDuplicates`.
//!
//! Drops duplicate items in a single input branch, keeping the **first**
//! occurrence (stable). Two modes mirror the n8n v2 surface:
//!
//! - `removeDuplicates` (default) — dedupe by comparing the entire item.
//!   Two items are considered equal when their JSON serialisation matches
//!   (so `{a:1,b:2}` and `{b:2,a:1}` are treated as duplicates because
//!   `serde_json::Map` preserves insertion order but we canonicalise the
//!   comparison via `Value::Object` -> sorted-key `String`).
//! - `compareSelectedFields` — dedupe by a subset of dotted key paths
//!   (`compareFields: ["id", "user.email"]`). Missing keys collapse to a
//!   single `null` bucket, matching n8n.
//!
//! No external deps; only `serde_json`.

use async_trait::async_trait;
use serde_json::{json, Map, Value};

use crate::{
    context::{value_at_path, ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct RemoveDuplicatesNode;

#[async_trait]
impl Node for RemoveDuplicatesNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "removeDuplicates",
            "Remove Duplicates",
            "Drop duplicate items, keeping the first occurrence",
            NodeCategory::Transform,
        )
        .icon("copy-minus")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("compare", "Compare", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "All Fields".into(),
                        value: json!("removeDuplicates"),
                        description: Some("Dedupe by deep-equal of the whole item".into()),
                    },
                    NodePropertyOption {
                        name: "Selected Fields".into(),
                        value: json!("compareSelectedFields"),
                        description: Some("Dedupe by a subset of key paths".into()),
                    },
                ])
                .default(json!("removeDuplicates")),
            NodeProperty::new("compareFields", "Compare Fields", NodePropertyType::Json)
                .description(
                    "Array of dotted key paths to compare. Items with matching values \
                     at every listed path are considered duplicates. Only used when \
                     compare = compareSelectedFields.",
                )
                .default(json!([]))
                .show_when("compare", &["compareSelectedFields"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let mode = ctx
            .param_str_opt(params, "compare")
            .unwrap_or_else(|| "removeDuplicates".to_string());

        let items = input.items;

        let out = match mode.as_str() {
            "removeDuplicates" => dedupe_all_fields(items),
            "compareSelectedFields" => {
                let fields = parse_compare_fields(params)?;
                dedupe_by_fields(items, &fields)
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "compare".into(),
                    reason: format!("unknown compare mode: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(out))
    }
}

/// Parse `compareFields` into a `Vec<String>`. Accepts a JSON array or a
/// comma-separated string for tolerance with hand-authored params.
fn parse_compare_fields(params: &Value) -> NodeResult<Vec<String>> {
    let raw = params.get("compareFields").cloned().unwrap_or(Value::Null);
    match raw {
        Value::Null => Ok(vec![]),
        Value::Array(arr) => {
            let mut out = Vec::with_capacity(arr.len());
            for v in arr {
                if let Some(s) = v.as_str() {
                    let s = s.trim();
                    if !s.is_empty() {
                        out.push(s.to_string());
                    }
                }
            }
            Ok(out)
        }
        Value::String(s) => Ok(s
            .split(',')
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .collect()),
        other => Err(NodeError::InvalidParameter {
            name: "compareFields".into(),
            reason: format!("expected an array or comma-separated string, got: {other}"),
        }),
    }
}

/// Dedupe by a canonical (sort-keys) JSON string of each item.
fn dedupe_all_fields(items: Vec<Value>) -> Vec<Value> {
    let mut seen: Vec<String> = Vec::with_capacity(items.len());
    let mut out: Vec<Value> = Vec::with_capacity(items.len());
    for item in items.into_iter() {
        let key = canonical_json(&item);
        if seen.iter().any(|k| k == &key) {
            continue;
        }
        seen.push(key);
        out.push(item);
    }
    out
}

/// Dedupe by composite key built from the values found at each `fields` path.
/// Missing values collapse to JSON `null` so two items both missing a key
/// share the same bucket (matches n8n).
fn dedupe_by_fields(items: Vec<Value>, fields: &[String]) -> Vec<Value> {
    if fields.is_empty() {
        // No keys selected — fall through to whole-item dedupe so the user
        // doesn't get silent pass-through.
        return dedupe_all_fields(items);
    }
    let mut seen: Vec<String> = Vec::with_capacity(items.len());
    let mut out: Vec<Value> = Vec::with_capacity(items.len());
    for item in items.into_iter() {
        let parts: Vec<Value> = fields
            .iter()
            .map(|f| value_at_path(&item, f).cloned().unwrap_or(Value::Null))
            .collect();
        let key = canonical_json(&Value::Array(parts));
        if seen.iter().any(|k| k == &key) {
            continue;
        }
        seen.push(key);
        out.push(item);
    }
    out
}

/// Render a JSON value with object keys sorted, so structurally equal items
/// with differing key insertion order still hash to the same string.
fn canonical_json(v: &Value) -> String {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut sorted = Map::with_capacity(map.len());
            for k in keys {
                if let Some(val) = map.get(k) {
                    sorted.insert(k.clone(), canonical_value(val));
                }
            }
            Value::Object(sorted).to_string()
        }
        other => other.to_string(),
    }
}

fn canonical_value(v: &Value) -> Value {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut sorted = Map::with_capacity(map.len());
            for k in keys {
                if let Some(val) = map.get(k) {
                    sorted.insert(k.clone(), canonical_value(val));
                }
            }
            Value::Object(sorted)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(canonical_value).collect()),
        other => other.clone(),
    }
}

// ─── tests ─────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".into(),
            Arc::new(reqwest::Client::new()),
        )
    }

    fn input(items: Vec<Value>) -> NodeInput {
        NodeInput { items }
    }

    #[tokio::test]
    async fn dedupe_all_fields_keeps_first_occurrence() {
        let mut c = ctx();
        let items = vec![
            json!({"id": 1, "v": "a"}),
            json!({"id": 1, "v": "a"}),
            json!({"id": 2, "v": "b"}),
            json!({"id": 1, "v": "a"}),
        ];
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &json!({}))
            .await
            .unwrap();
        let branch = &out.branches[0].items;
        assert_eq!(branch.len(), 2);
        assert_eq!(branch[0]["id"], 1);
        assert_eq!(branch[1]["id"], 2);
    }

    #[tokio::test]
    async fn dedupe_all_fields_ignores_key_order() {
        let mut c = ctx();
        let items = vec![json!({"a": 1, "b": 2}), json!({"b": 2, "a": 1})];
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &json!({}))
            .await
            .unwrap();
        assert_eq!(out.branches[0].items.len(), 1);
    }

    #[tokio::test]
    async fn dedupe_by_single_field() {
        let mut c = ctx();
        let items = vec![
            json!({"id": 1, "name": "alice"}),
            json!({"id": 1, "name": "alice-edit"}),
            json!({"id": 2, "name": "bob"}),
            json!({"id": 2, "name": "bob-edit"}),
        ];
        let params = json!({
            "compare": "compareSelectedFields",
            "compareFields": ["id"],
        });
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &params)
            .await
            .unwrap();
        let branch = &out.branches[0].items;
        assert_eq!(branch.len(), 2);
        assert_eq!(branch[0]["name"], "alice");
        assert_eq!(branch[1]["name"], "bob");
    }

    #[tokio::test]
    async fn dedupe_by_dotted_path() {
        let mut c = ctx();
        let items = vec![
            json!({"user": {"email": "a@x.com"}, "ts": 1}),
            json!({"user": {"email": "a@x.com"}, "ts": 2}),
            json!({"user": {"email": "b@x.com"}, "ts": 3}),
        ];
        let params = json!({
            "compare": "compareSelectedFields",
            "compareFields": ["user.email"],
        });
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &params)
            .await
            .unwrap();
        let branch = &out.branches[0].items;
        assert_eq!(branch.len(), 2);
        assert_eq!(branch[0]["ts"], 1);
        assert_eq!(branch[1]["ts"], 3);
    }

    #[tokio::test]
    async fn dedupe_by_multiple_fields() {
        let mut c = ctx();
        let items = vec![
            json!({"a": 1, "b": 1, "v": "x"}),
            json!({"a": 1, "b": 2, "v": "y"}),
            json!({"a": 1, "b": 1, "v": "z"}),
        ];
        let params = json!({
            "compare": "compareSelectedFields",
            "compareFields": ["a", "b"],
        });
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &params)
            .await
            .unwrap();
        let branch = &out.branches[0].items;
        assert_eq!(branch.len(), 2);
        assert_eq!(branch[0]["v"], "x");
        assert_eq!(branch[1]["v"], "y");
    }

    #[tokio::test]
    async fn missing_field_groups_under_null() {
        let mut c = ctx();
        let items = vec![
            json!({"id": 1}),
            json!({"other": "thing"}),
            json!({"yet": "another"}),
        ];
        let params = json!({
            "compare": "compareSelectedFields",
            "compareFields": ["id"],
        });
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &params)
            .await
            .unwrap();
        // {id:1} and one of the missing-id items survive; the other missing
        // collapses into the same null bucket.
        assert_eq!(out.branches[0].items.len(), 2);
    }

    #[tokio::test]
    async fn empty_input_emits_empty_branch() {
        let mut c = ctx();
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(vec![]), &json!({}))
            .await
            .unwrap();
        assert_eq!(out.branches.len(), 1);
        assert!(out.branches[0].items.is_empty());
    }

    #[tokio::test]
    async fn comma_separated_compare_fields_string_works() {
        let mut c = ctx();
        let items = vec![json!({"a": 1, "b": 1}), json!({"a": 1, "b": 2})];
        let params = json!({
            "compare": "compareSelectedFields",
            "compareFields": "a",
        });
        let out = RemoveDuplicatesNode
            .execute(&mut c, input(items), &params)
            .await
            .unwrap();
        assert_eq!(out.branches[0].items.len(), 1);
    }

    #[tokio::test]
    async fn unknown_compare_mode_errors() {
        let mut c = ctx();
        let params = json!({ "compare": "wat" });
        let err = RemoveDuplicatesNode
            .execute(&mut c, input(vec![json!({})]), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "compare"),
            other => panic!("expected InvalidParameter(compare), got {other:?}"),
        }
    }
}
