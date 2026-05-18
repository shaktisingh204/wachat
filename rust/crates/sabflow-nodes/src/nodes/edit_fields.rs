//! Edit Fields node — `n8n-nodes-base.editFields` (Set V3).
//!
//! n8n unified the classic Set node into "Edit Fields" at typeVersion 3.
//! The descriptor exposes two top-level modes:
//!
//! - `manual` — declare each output field as `{ name, type, value }` and
//!   the engine renders + coerces every entry onto a clone of the input.
//! - `raw` (a.k.a. `json`) — replace each item with a literal JSON object
//!   you paste into the `jsonOutput` field. Useful when you want to
//!   produce a completely new shape.
//!
//! For `manual`, the value coercion table mirrors the TS implementation in
//! `src/lib/sabflow/executor/nodes/set.ts::coerce`:
//!
//! | type      | accepts                                  | result
//! |-----------|------------------------------------------|----------------
//! | `string`  | anything                                 | as-rendered
//! | `number`  | finite numeric string                    | `f64`
//! | `boolean` | `true/1/yes/on` vs `false/0/no/off/""`   | bool
//! | `array`   | JSON array literal                       | array
//! | `object`  | JSON object literal                      | object
//!
//! Like the classic Set node, dotted keys create nested objects unless
//! `options.dotNotation` is explicitly set to `false`.

use async_trait::async_trait;
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
    nodes::set::assign_at_path,
};

pub struct EditFieldsNode;

#[async_trait]
impl Node for EditFieldsNode {
    fn descriptor(&self) -> NodeDescriptor {
        let assignment_children = vec![
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("fieldName")
                .required(),
            NodeProperty::new("type", "Type", NodePropertyType::Options)
                .options(vec![
                    opt("String", "string"),
                    opt("Number", "number"),
                    opt("Boolean", "boolean"),
                    opt("Array", "array"),
                    opt("Object", "object"),
                ])
                .default(Value::String("string".into())),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("Value or {{expression}}"),
        ];

        let mut assignments_prop =
            NodeProperty::new("fields", "Fields to Set", NodePropertyType::Collection)
                .description("Each entry assigns `name = coerce(value, type)` onto the output item.")
                .show_when("mode", &["manual"]);
        assignments_prop.children = assignment_children;

        let mut options_prop = NodeProperty::new("options", "Options", NodePropertyType::Collection)
            .description("Behaviour switches: `keepOnlySet` and `dotNotation`.");
        options_prop.children = vec![
            NodeProperty::new("keepOnlySet", "Keep Only Set", NodePropertyType::Boolean)
                .default(Value::Bool(false))
                .description("If true, drop all incoming JSON keys and emit only the declared fields."),
            NodeProperty::new("dotNotation", "Dot Notation", NodePropertyType::Boolean)
                .default(Value::Bool(true))
                .description("When true, dotted names create nested objects."),
        ];

        NodeDescriptor::new(
            "editFields",
            "Edit Fields (Set)",
            "Assign or replace fields on each item — Set V3",
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
                        description: Some(
                            "Declare each output field — name, type, value.".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "JSON Output".into(),
                        value: Value::String("raw".into()),
                        description: Some(
                            "Replace each item with the JSON literal you paste below.".into(),
                        ),
                    },
                ])
                .default(Value::String("manual".into())),
            assignments_prop,
            NodeProperty::new("jsonOutput", "JSON Output", NodePropertyType::Json)
                .show_when("mode", &["raw"])
                .description("JSON literal that replaces each input item."),
            options_prop,
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
            .unwrap_or_else(|| "manual".to_string());

        let items_in = if input.items.is_empty() {
            vec![Value::Object(Map::new())]
        } else {
            input.items
        };

        match mode.as_str() {
            "manual" | "" => execute_manual(ctx, params, items_in),
            "raw" | "json" => execute_raw(ctx, params, items_in),
            other => Err(NodeError::InvalidParameter {
                name: "mode".into(),
                reason: format!("unknown editFields mode: {other}"),
            }),
        }
    }
}

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: Value::String(value.to_string()),
        description: None,
    }
}

/// Manual mode — `fields: [{ name, type, value }]` per item.
fn execute_manual(
    ctx: &ExecutionContext,
    params: &Value,
    items: Vec<Value>,
) -> NodeResult<NodeOutput> {
    let keep_only = read_opt_bool(params, "keepOnlySet", false);
    let dot_notation = read_opt_bool(params, "dotNotation", true);
    let raw_fields = collect_assignments(params);

    let mut out_items: Vec<Value> = Vec::with_capacity(items.len());

    for (idx, item) in items.into_iter().enumerate() {
        let mut obj: Map<String, Value> = if keep_only {
            Map::new()
        } else {
            match item {
                Value::Object(map) => map,
                Value::Null => Map::new(),
                other => {
                    let mut m = Map::new();
                    m.insert("value".into(), other);
                    m
                }
            }
        };

        for entry in raw_fields.iter() {
            let Some(name) = entry.get("name").and_then(|v| v.as_str()) else {
                continue;
            };
            if name.is_empty() {
                continue;
            }
            let field_type = entry
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("string");
            let raw_value = entry.get("value");
            let rendered = render_value(ctx, raw_value);
            let coerced = coerce(field_type, rendered, name, idx)?;
            assign_at_path(&mut obj, name, coerced, dot_notation);
        }

        out_items.push(Value::Object(obj));
    }

    Ok(NodeOutput::single(out_items))
}

/// Raw mode — replace each item with `jsonOutput` (substituted + parsed).
fn execute_raw(
    ctx: &ExecutionContext,
    params: &Value,
    items: Vec<Value>,
) -> NodeResult<NodeOutput> {
    let raw = params.get("jsonOutput");
    let template = match raw {
        Some(Value::String(s)) => s.clone(),
        Some(other) => other.to_string(),
        None => "{}".to_string(),
    };

    // Substitute expressions once — raw mode treats the literal as a single
    // template, not per-item (n8n parity: no $json in the raw template).
    let substituted = ctx.substitute(&template);
    let parsed: Value = serde_json::from_str(&substituted).map_err(|e| {
        NodeError::InvalidParameter {
            name: "jsonOutput".into(),
            reason: format!("not valid JSON after substitution: {e}"),
        }
    })?;

    let out_items: Vec<Value> = items.into_iter().map(|_| parsed.clone()).collect();
    Ok(NodeOutput::single(out_items))
}

/// Accept `[{ name, type, value }]` or `{ values: [...] }` for parity with
/// the editor's `fixedCollection` envelope.
fn collect_assignments(params: &Value) -> Vec<Value> {
    let raw = params.get("fields").or_else(|| params.get("assignments"));
    match raw {
        Some(Value::Array(arr)) => arr.clone(),
        Some(Value::Object(map)) => {
            for key in &["values", "assignments", "fields"] {
                if let Some(Value::Array(inner)) = map.get(*key) {
                    return inner.clone();
                }
            }
            vec![Value::Object(map.clone())]
        }
        _ => vec![],
    }
}

fn read_opt_bool(params: &Value, key: &str, default: bool) -> bool {
    params
        .get("options")
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

/// Substitute `{{...}}` tokens on string values; leave non-string JSON as-is.
fn render_value(ctx: &ExecutionContext, raw: Option<&Value>) -> Value {
    match raw {
        Some(Value::String(s)) => Value::String(ctx.substitute(s)),
        Some(other) => other.clone(),
        None => Value::Null,
    }
}

/// Coerce a rendered Value into the declared type.
///
/// Matches `src/lib/sabflow/executor/nodes/set.ts::coerce`. Non-string
/// inputs short-circuit when the target type already matches.
fn coerce(
    target_type: &str,
    rendered: Value,
    field_name: &str,
    item_index: usize,
) -> NodeResult<Value> {
    match target_type {
        "string" => match rendered {
            Value::String(s) => Ok(Value::String(s)),
            Value::Null => Ok(Value::String(String::new())),
            other => Ok(Value::String(value_to_plain_string(&other))),
        },
        "number" => match rendered {
            Value::Number(_) => Ok(rendered),
            Value::String(s) => parse_number(&s, field_name, item_index),
            Value::Bool(b) => Ok(Value::Number(serde_json::Number::from(b as u8))),
            other => Err(coerce_err(
                field_name,
                item_index,
                format!("cannot coerce {} to number", value_kind(&other)),
            )),
        },
        "boolean" => match rendered {
            Value::Bool(_) => Ok(rendered),
            Value::String(s) => parse_bool(&s, field_name, item_index),
            Value::Number(n) => Ok(Value::Bool(
                n.as_f64().map(|x| x != 0.0).unwrap_or(false),
            )),
            Value::Null => Ok(Value::Bool(false)),
            other => Err(coerce_err(
                field_name,
                item_index,
                format!("cannot coerce {} to boolean", value_kind(&other)),
            )),
        },
        "array" => match rendered {
            Value::Array(_) => Ok(rendered),
            Value::String(s) => parse_array(&s, field_name, item_index),
            other => Err(coerce_err(
                field_name,
                item_index,
                format!("cannot coerce {} to array", value_kind(&other)),
            )),
        },
        "object" => match rendered {
            Value::Object(_) => Ok(rendered),
            Value::String(s) => parse_object(&s, field_name, item_index),
            other => Err(coerce_err(
                field_name,
                item_index,
                format!("cannot coerce {} to object", value_kind(&other)),
            )),
        },
        other => Err(coerce_err(
            field_name,
            item_index,
            format!("unknown value type: {other}"),
        )),
    }
}

fn parse_number(s: &str, field_name: &str, idx: usize) -> NodeResult<Value> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(coerce_err(
            field_name,
            idx,
            "cannot coerce empty string to number".into(),
        ));
    }
    match trimmed.parse::<f64>() {
        Ok(n) if n.is_finite() => Ok(Value::Number(
            serde_json::Number::from_f64(n).unwrap_or_else(|| serde_json::Number::from(0)),
        )),
        _ => Err(coerce_err(
            field_name,
            idx,
            format!("value {trimmed:?} is not a finite number"),
        )),
    }
}

fn parse_bool(s: &str, field_name: &str, idx: usize) -> NodeResult<Value> {
    match s.trim().to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => Ok(Value::Bool(true)),
        "false" | "0" | "no" | "off" | "" => Ok(Value::Bool(false)),
        other => Err(coerce_err(
            field_name,
            idx,
            format!("value {other:?} is not a valid boolean"),
        )),
    }
}

fn parse_array(s: &str, field_name: &str, idx: usize) -> NodeResult<Value> {
    let parsed: Value = serde_json::from_str(s).map_err(|e| {
        coerce_err(
            field_name,
            idx,
            format!("value is not valid JSON (expected an array): {e}"),
        )
    })?;
    if !parsed.is_array() {
        return Err(coerce_err(
            field_name,
            idx,
            "JSON parsed but is not an array".into(),
        ));
    }
    Ok(parsed)
}

fn parse_object(s: &str, field_name: &str, idx: usize) -> NodeResult<Value> {
    let parsed: Value = serde_json::from_str(s).map_err(|e| {
        coerce_err(
            field_name,
            idx,
            format!("value is not valid JSON (expected an object): {e}"),
        )
    })?;
    if !parsed.is_object() {
        return Err(coerce_err(
            field_name,
            idx,
            "JSON parsed but is not an object".into(),
        ));
    }
    Ok(parsed)
}

fn coerce_err(field_name: &str, idx: usize, reason: String) -> NodeError {
    NodeError::InvalidParameter {
        name: format!("fields[{idx}].{field_name}"),
        reason,
    }
}

fn value_to_plain_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn value_kind(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coerce_string_passthrough() {
        let v = coerce("string", Value::String("hello".into()), "f", 0).unwrap();
        assert_eq!(v, Value::String("hello".into()));
    }

    #[test]
    fn coerce_number_parses_string() {
        let v = coerce("number", Value::String("42.5".into()), "f", 0).unwrap();
        assert_eq!(v.as_f64(), Some(42.5));
    }

    #[test]
    fn coerce_boolean_accepts_truthy_strings() {
        for s in ["true", "1", "yes", "on", "TRUE"] {
            let v = coerce("boolean", Value::String(s.into()), "f", 0).unwrap();
            assert_eq!(v, Value::Bool(true));
        }
        for s in ["false", "0", "no", "off", ""] {
            let v = coerce("boolean", Value::String(s.into()), "f", 0).unwrap();
            assert_eq!(v, Value::Bool(false));
        }
    }

    #[test]
    fn coerce_array_rejects_non_array_json() {
        let err = coerce("array", Value::String("{\"a\":1}".into()), "f", 0).unwrap_err();
        match err {
            NodeError::InvalidParameter { reason, .. } => {
                assert!(reason.contains("not an array"));
            }
            _ => panic!("expected InvalidParameter"),
        }
    }
}
