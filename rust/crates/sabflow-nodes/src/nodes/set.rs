//! Set node — `n8n-nodes-base.set` parity (typeVersion 1/2).
//!
//! The classic Set node walks every input item and overlays a list of
//! `{ name, value }` pairs on top of the existing JSON. The keys may be
//! **dotted paths** (`a.b.c`) — segments are split on `.` and intermediate
//! objects are auto-created so the path is always reachable. When
//! `keepOnlySet` is true, the output starts from an empty object and only
//! the explicitly declared fields survive.
//!
//! ### Parity contract (matches `src/lib/sabflow/executor/nodes/set.ts`)
//!
//! - `keepOnlySet: bool` — drop incoming keys.
//! - `values: [{ name, value }]` — fields to assign. Strings flow through
//!   `ctx.substitute` so `{{var}}` / `{{$json.field}}` tokens render against
//!   the current execution context.
//! - `options.dotNotation: bool` (default `true`) — when `false`, the full
//!   `name` is used as a literal key (even if it contains dots).
//!
//! When the upstream branch is empty we still emit one row built off an
//! empty object so a Set node placed at the head of a manual run produces
//! something visible — this mirrors n8n's behaviour.

use async_trait::async_trait;
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct SetNode;

#[async_trait]
impl Node for SetNode {
    fn descriptor(&self) -> NodeDescriptor {
        let value_children = vec![
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("fieldName")
                .required(),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("Value or {{expression}}"),
        ];

        let mut values_prop =
            NodeProperty::new("values", "Values to Set", NodePropertyType::Collection)
                .description("List of fields to set on each item");
        values_prop.children = value_children;

        let mut options_prop = NodeProperty::new("options", "Options", NodePropertyType::Collection)
            .description("Per-node options. `dotNotation` (default: true) controls whether field names are parsed as dotted paths.");
        options_prop.children = vec![
            NodeProperty::new("dotNotation", "Dot Notation", NodePropertyType::Boolean)
                .default(Value::Bool(true))
                .description(
                    "When true, field names with dots are interpreted as nested object paths.",
                ),
        ];

        NodeDescriptor::new(
            "set",
            "Set",
            "Set or modify item fields",
            NodeCategory::Transform,
        )
        .icon("pencil")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Manual Mapping".into(),
                        value: Value::String("manual".into()),
                        description: Some("Define each field manually".into()),
                    },
                    NodePropertyOption {
                        name: "Expression".into(),
                        value: Value::String("expression".into()),
                        description: Some(
                            "Evaluate an expression for each field".into(),
                        ),
                    },
                ])
                .default(Value::String("manual".into())),
            NodeProperty::new("keepOnlySet", "Keep Only Set", NodePropertyType::Boolean)
                .description("If true, output only the fields you define here")
                .default(Value::Bool(false)),
            values_prop,
            options_prop,
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let keep_only = ctx.param_bool(params, "keepOnlySet", false);
        let dot_notation = read_dot_notation(params);

        // Collect `{ name, value }` pairs. Accept the canonical array shape
        // and the n8n `fixedCollection` envelope `{ values: [...] }`.
        let raw_values = collect_values(params.get("values"));

        let items = if input.items.is_empty() {
            // Even with no upstream items, run once so a Set node placed at the
            // top of a manual run still produces an output row.
            vec![Value::Object(Map::new())]
        } else {
            input.items
        };

        let mut out_items: Vec<Value> = Vec::with_capacity(items.len());

        for item in items.into_iter() {
            let mut obj: Map<String, Value> = if keep_only {
                Map::new()
            } else {
                match item {
                    Value::Object(map) => map,
                    Value::Null => Map::new(),
                    other => {
                        // Non-object inputs are wrapped under `value` so the
                        // assign operations below can still target dotted paths.
                        let mut m = Map::new();
                        m.insert("value".into(), other);
                        m
                    }
                }
            };

            for entry in raw_values.iter() {
                let Some(name) = entry.get("name").and_then(|v| v.as_str()) else {
                    continue;
                };
                if name.is_empty() {
                    continue;
                }
                let value = match entry.get("value") {
                    Some(Value::String(s)) => Value::String(ctx.substitute(s)),
                    Some(other) => other.clone(),
                    None => Value::Null,
                };
                assign_at_path(&mut obj, name, value, dot_notation);
            }

            out_items.push(Value::Object(obj));
        }

        Ok(NodeOutput::single(out_items))
    }
}

/// Read the `options.dotNotation` toggle. Defaults to `true` (n8n parity).
fn read_dot_notation(params: &Value) -> bool {
    params
        .get("options")
        .and_then(|v| v.get("dotNotation"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

/// Accept either `[ { name, value } ]` or `{ values: [...] }`.
fn collect_values(raw: Option<&Value>) -> Vec<Value> {
    match raw {
        Some(Value::Array(arr)) => arr.clone(),
        Some(Value::Object(map)) => {
            // n8n's fixedCollection envelope: `{ values: [...] }`.
            if let Some(Value::Array(inner)) = map.get("values") {
                inner.clone()
            } else {
                // Some UIs serialize a single collection entry as an object —
                // tolerate it by wrapping in a one-element array.
                vec![Value::Object(map.clone())]
            }
        }
        _ => vec![],
    }
}

/// Assign `value` at `path` inside `target`.
///
/// When `dot_notation` is true the path is split on `.`; intermediate
/// non-object segments are overwritten with fresh objects so the path is
/// always reachable. Mirrors the TS implementation in
/// `src/lib/sabflow/executor/nodes/set.ts::assignAtPath`.
pub(crate) fn assign_at_path(
    target: &mut Map<String, Value>,
    path: &str,
    value: Value,
    dot_notation: bool,
) {
    if !dot_notation {
        target.insert(path.to_string(), value);
        return;
    }
    let segments: Vec<&str> = path.split('.').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return;
    }
    if segments.len() == 1 {
        target.insert(segments[0].to_string(), value);
        return;
    }
    assign_segments(target, &segments, value);
}

/// Recursive helper that walks `segments` (already non-empty) and assigns
/// `value` at the tail. Each frame holds exactly one `&mut Map` borrow,
/// which keeps NLL happy without the iterative reborrow dance.
fn assign_segments(target: &mut Map<String, Value>, segments: &[&str], value: Value) {
    if segments.len() == 1 {
        target.insert(segments[0].to_string(), value);
        return;
    }
    let head = segments[0];
    let slot = target
        .entry(head.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !slot.is_object() {
        *slot = Value::Object(Map::new());
    }
    if let Value::Object(inner) = slot {
        assign_segments(inner, &segments[1..], value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dotted_path_creates_intermediate_objects() {
        let mut obj = Map::new();
        assign_at_path(&mut obj, "a.b.c", Value::String("v".into()), true);
        assert_eq!(
            Value::Object(obj.clone())["a"]["b"]["c"],
            Value::String("v".into())
        );
    }

    #[test]
    fn dot_notation_off_uses_literal_key() {
        let mut obj = Map::new();
        assign_at_path(&mut obj, "a.b", Value::Bool(true), false);
        assert_eq!(obj.get("a.b"), Some(&Value::Bool(true)));
        assert!(obj.get("a").is_none());
    }

    #[test]
    fn dotted_path_overwrites_non_object_intermediate() {
        let mut obj = Map::new();
        obj.insert("a".into(), Value::Number(5.into()));
        assign_at_path(&mut obj, "a.b", Value::String("x".into()), true);
        assert_eq!(
            Value::Object(obj.clone())["a"]["b"],
            Value::String("x".into())
        );
    }
}
