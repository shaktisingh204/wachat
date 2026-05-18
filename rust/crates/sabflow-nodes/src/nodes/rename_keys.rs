//! Rename Keys node — relabel fields on each item flowing through.
//!
//! Mirrors n8n's `renameKeys` node. Each entry in `keys` is `{ from, to }`;
//! the rename is applied per-item across the entire input branch. Renames
//! that would collide with another field (or another rename) are flagged as
//! errors when `failOnCollision` is true; otherwise the later write wins.
//!
//! Supports dotted paths (`a.b` → `x.y`) for nested-field renames. Any path
//! that doesn't exist on the current item is silently skipped.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct RenameKeysNode;

#[async_trait]
impl Node for RenameKeysNode {
    fn descriptor(&self) -> NodeDescriptor {
        let mut keys_prop = NodeProperty::new("keys", "Keys", NodePropertyType::Collection)
            .description("List of `{ from, to }` rename pairs");
        keys_prop.children = vec![
            NodeProperty::new("from", "From", NodePropertyType::String)
                .placeholder("oldName")
                .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("newName")
                .required(),
        ];

        NodeDescriptor::new(
            "renameKeys",
            "Rename Keys",
            "Rename fields on each item",
            NodeCategory::Transform,
        )
        .icon("text-cursor")
        .color("#0ea5e9")
        .properties(vec![
            keys_prop,
            NodeProperty::new("failOnCollision", "Fail on Collision", NodePropertyType::Boolean)
                .description("Error if a rename target already exists on the item")
                .default(json!(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let fail_on_collision = ctx.param_bool(params, "failOnCollision", false);

        // Collect `{ from, to }` pairs. Accept either a JSON array or a
        // single-object form (some UIs emit objects when only one entry).
        let pairs: Vec<(String, String)> = params
            .get("keys")
            .map(|v| match v {
                Value::Array(a) => a
                    .iter()
                    .filter_map(extract_pair)
                    .collect::<Vec<_>>(),
                Value::Object(_) => extract_pair(v).into_iter().collect(),
                _ => vec![],
            })
            .unwrap_or_default();

        // Pre-substitute placeholders on both sides so `{{var}}` works.
        let pairs: Vec<(String, String)> = pairs
            .into_iter()
            .map(|(f, t)| (ctx.substitute(&f), ctx.substitute(&t)))
            .filter(|(f, t)| !f.is_empty() && !t.is_empty())
            .collect();

        let mut out_items: Vec<Value> = Vec::with_capacity(input.items.len());
        for item in input.items.into_iter() {
            let mut current = item;
            for (from, to) in pairs.iter() {
                if from == to {
                    continue;
                }
                let from_path = parse_path(from);
                let to_path = parse_path(to);

                let Some(value) = remove_path(&mut current, &from_path) else {
                    continue;
                };

                if fail_on_collision && get_path(&current, &to_path).is_some() {
                    return Err(NodeError::InvalidParameter {
                        name: "keys".into(),
                        reason: format!("rename `{from}` → `{to}` collides with existing key"),
                    });
                }
                set_path(&mut current, &to_path, value);
            }
            out_items.push(current);
        }

        Ok(NodeOutput::single(out_items))
    }
}

fn extract_pair(v: &Value) -> Option<(String, String)> {
    let from = v.get("from").and_then(|v| v.as_str())?.to_string();
    let to = v.get("to").and_then(|v| v.as_str())?.to_string();
    Some((from, to))
}

fn parse_path(p: &str) -> Vec<String> {
    p.split('.').map(|s| s.to_string()).collect()
}

fn get_path<'a>(v: &'a Value, path: &[String]) -> Option<&'a Value> {
    let mut cur = v;
    for part in path {
        cur = cur.as_object()?.get(part)?;
    }
    Some(cur)
}

fn remove_path(v: &mut Value, path: &[String]) -> Option<Value> {
    if path.is_empty() {
        return None;
    }
    if path.len() == 1 {
        return v.as_object_mut()?.remove(&path[0]);
    }
    let head = &path[0];
    let next = v.as_object_mut()?.get_mut(head)?;
    remove_path(next, &path[1..])
}

fn set_path(v: &mut Value, path: &[String], value: Value) {
    if path.is_empty() {
        return;
    }
    if !v.is_object() {
        *v = Value::Object(Map::new());
    }
    let mut cur = v;
    for part in &path[..path.len() - 1] {
        if !cur.as_object().is_some_and(|m| m.contains_key(part)) {
            cur.as_object_mut()
                .unwrap()
                .insert(part.clone(), Value::Object(Map::new()));
        }
        cur = cur.as_object_mut().unwrap().get_mut(part).unwrap();
        if !cur.is_object() {
            *cur = Value::Object(Map::new());
        }
    }
    let last = &path[path.len() - 1];
    cur.as_object_mut().unwrap().insert(last.clone(), value);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_path_splits_on_dot() {
        assert_eq!(parse_path("a.b.c"), vec!["a", "b", "c"]);
        assert_eq!(parse_path("flat"), vec!["flat"]);
    }

    #[test]
    fn set_path_creates_nested_objects() {
        let mut v = json!({});
        set_path(&mut v, &parse_path("a.b.c"), json!(42));
        assert_eq!(v, json!({"a": {"b": {"c": 42}}}));
    }

    #[test]
    fn remove_path_pulls_nested_field() {
        let mut v = json!({"a": {"b": "hi"}});
        let got = remove_path(&mut v, &parse_path("a.b"));
        assert_eq!(got, Some(Value::String("hi".into())));
        assert_eq!(v, json!({"a": {}}));
    }

    #[test]
    fn get_path_returns_nested_value() {
        let v = json!({"a": {"b": 3}});
        assert_eq!(get_path(&v, &parse_path("a.b")), Some(&json!(3)));
        assert_eq!(get_path(&v, &parse_path("a.c")), None);
    }
}
