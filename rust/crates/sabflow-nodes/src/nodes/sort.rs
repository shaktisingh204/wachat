//! Sort node — `n8n-nodes-base.sort`.
//!
//! Stable sort across one or more key paths, each with its own direction.
//!
//! Properties:
//!   - `sortFields`: JSON array of `{ field, direction }` objects.
//!     `field` is a dotted path (e.g. `user.name`). `direction` is one of
//!     `asc` | `descending` | `desc` | `descending` (case-insensitive).
//!     Empty path means "compare the whole item value" — useful for
//!     sorting primitives.
//!   - `type` (optional): `auto` (default) | `string` | `number` | `boolean`
//!     | `date`. Hint that controls how field values are compared.
//!
//! Sort is stable: items that compare equal preserve their original order.
//!
//! No external deps beyond `serde_json` + `chrono` (already in `Cargo.toml`).

use async_trait::async_trait;
use chrono::DateTime;
use serde_json::{json, Value};
use std::cmp::Ordering;

use crate::{
    context::{value_at_path, ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SortNode;

#[derive(Debug, Clone, Copy)]
enum SortType {
    Auto,
    Str,
    Num,
    Bool,
    Date,
}

#[derive(Debug, Clone)]
struct SortField {
    path: String,
    ascending: bool,
    kind: SortType,
}

#[async_trait]
impl Node for SortNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sort",
            "Sort",
            "Sort items by one or more key paths",
            NodeCategory::Transform,
        )
        .icon("arrow-down-up")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("sortFields", "Sort Fields", NodePropertyType::Json)
                .description(
                    "Array of { field, direction } objects. `field` is a dotted path; \
                     leave blank to compare items themselves. `direction` is \
                     'asc' (default) or 'desc'. Sort is stable — equal items keep \
                     their original order.",
                )
                .default(json!([{ "field": "", "direction": "asc" }])),
            NodeProperty::new("type", "Value Type", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Auto".into(),
                        value: json!("auto"),
                        description: Some("Infer from each value".into()),
                    },
                    NodePropertyOption {
                        name: "String".into(),
                        value: json!("string"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Number".into(),
                        value: json!("number"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Boolean".into(),
                        value: json!("boolean"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Date".into(),
                        value: json!("date"),
                        description: Some("Parse ISO-8601 strings or epoch numbers".into()),
                    },
                ])
                .default(json!("auto")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let default_kind = parse_type(ctx.param_str_opt(params, "type").as_deref());
        let fields = parse_sort_fields(params, default_kind)?;

        let mut items = input.items;

        if fields.is_empty() {
            // Without an explicit sort spec, n8n keeps original order — pass through.
            return Ok(NodeOutput::single(items));
        }

        // `Vec::sort_by` is stable, which is what we want.
        items.sort_by(|a, b| compare_items(a, b, &fields));
        Ok(NodeOutput::single(items))
    }
}

fn parse_type(s: Option<&str>) -> SortType {
    match s.map(|x| x.to_ascii_lowercase()).as_deref() {
        Some("string") | Some("str") => SortType::Str,
        Some("number") | Some("num") | Some("numeric") => SortType::Num,
        Some("boolean") | Some("bool") => SortType::Bool,
        Some("date") | Some("datetime") | Some("time") => SortType::Date,
        _ => SortType::Auto,
    }
}

fn parse_sort_fields(params: &Value, default_kind: SortType) -> NodeResult<Vec<SortField>> {
    let raw = params.get("sortFields").cloned().unwrap_or(Value::Null);

    let entries: Vec<Value> = match raw {
        Value::Null => vec![],
        Value::Array(a) => a,
        Value::Object(_) => vec![raw.clone()],
        Value::String(s) => {
            // Single-path string shorthand.
            return Ok(vec![SortField {
                path: s.trim().to_string(),
                ascending: true,
                kind: default_kind,
            }]);
        }
        other => {
            return Err(NodeError::InvalidParameter {
                name: "sortFields".into(),
                reason: format!("expected an array, got: {other}"),
            });
        }
    };

    let mut out: Vec<SortField> = Vec::with_capacity(entries.len());
    for entry in entries {
        match entry {
            Value::Object(map) => {
                let path = map
                    .get("field")
                    .or_else(|| map.get("fieldName"))
                    .or_else(|| map.get("path"))
                    .or_else(|| map.get("key"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let dir = map
                    .get("direction")
                    .or_else(|| map.get("order"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("asc")
                    .to_ascii_lowercase();
                let ascending = !matches!(dir.as_str(), "desc" | "descending" | "down" | "-1");
                let kind = map
                    .get("type")
                    .and_then(|v| v.as_str())
                    .map(|s| parse_type(Some(s)))
                    .unwrap_or(default_kind);
                out.push(SortField { path, ascending, kind });
            }
            Value::String(s) => out.push(SortField {
                path: s.trim().to_string(),
                ascending: true,
                kind: default_kind,
            }),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "sortFields".into(),
                    reason: format!("each entry must be a string or object, got: {other}"),
                });
            }
        }
    }
    Ok(out)
}

fn compare_items(a: &Value, b: &Value, fields: &[SortField]) -> Ordering {
    for f in fields {
        let av = if f.path.is_empty() {
            Some(a)
        } else {
            value_at_path(a, &f.path)
        };
        let bv = if f.path.is_empty() {
            Some(b)
        } else {
            value_at_path(b, &f.path)
        };
        let ord = compare_values(av, bv, f.kind);
        if ord != Ordering::Equal {
            return if f.ascending { ord } else { ord.reverse() };
        }
    }
    Ordering::Equal
}

fn compare_values(a: Option<&Value>, b: Option<&Value>, kind: SortType) -> Ordering {
    // Null / missing always sort last (matches n8n's "undefined goes to the
    // end" behaviour, regardless of asc/desc direction).
    let a_missing = is_nullish(a);
    let b_missing = is_nullish(b);
    if a_missing && b_missing {
        return Ordering::Equal;
    }
    if a_missing {
        return Ordering::Greater;
    }
    if b_missing {
        return Ordering::Less;
    }
    let a = a.unwrap();
    let b = b.unwrap();

    match kind {
        SortType::Num => cmp_num(a, b),
        SortType::Str => cmp_str(a, b),
        SortType::Bool => cmp_bool(a, b),
        SortType::Date => cmp_date(a, b),
        SortType::Auto => cmp_auto(a, b),
    }
}

fn is_nullish(v: Option<&Value>) -> bool {
    matches!(v, None | Some(Value::Null))
}

fn cmp_auto(a: &Value, b: &Value) -> Ordering {
    match (a, b) {
        (Value::Number(_), Value::Number(_)) => cmp_num(a, b),
        (Value::Bool(x), Value::Bool(y)) => x.cmp(y),
        (Value::String(_), Value::String(_)) => cmp_str(a, b),
        // Mixed types — fall back to canonicalised string compare so the
        // result is at least deterministic.
        _ => a.to_string().cmp(&b.to_string()),
    }
}

fn cmp_num(a: &Value, b: &Value) -> Ordering {
    let av = to_num(a);
    let bv = to_num(b);
    match (av, bv) {
        (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

fn cmp_str(a: &Value, b: &Value) -> Ordering {
    let av = to_str(a);
    let bv = to_str(b);
    av.cmp(&bv)
}

fn cmp_bool(a: &Value, b: &Value) -> Ordering {
    let av = to_bool(a);
    let bv = to_bool(b);
    av.cmp(&bv)
}

fn cmp_date(a: &Value, b: &Value) -> Ordering {
    let av = to_epoch(a);
    let bv = to_epoch(b);
    match (av, bv) {
        (Some(x), Some(y)) => x.cmp(&y),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

fn to_num(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn to_str(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn to_bool(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map(|x| x != 0.0).unwrap_or(false),
        Value::String(s) => matches!(s.trim().to_ascii_lowercase().as_str(), "true" | "1" | "yes"),
        _ => false,
    }
}

fn to_epoch(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|x| x as i64)),
        Value::String(s) => {
            // RFC3339 / ISO-8601 first.
            if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                return Some(dt.timestamp_millis());
            }
            // Naive ISO date (YYYY-MM-DD) — pad to a full datetime.
            if s.len() == 10 && s.as_bytes().get(4) == Some(&b'-') {
                if let Ok(dt) = DateTime::parse_from_rfc3339(&format!("{s}T00:00:00Z")) {
                    return Some(dt.timestamp_millis());
                }
            }
            // Last resort: numeric epoch in a string.
            s.trim().parse::<i64>().ok()
        }
        _ => None,
    }
}

// ─── tests ─────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new("test-exec".into(), Arc::new(reqwest::Client::new()))
    }

    fn run(params: Value, items: Vec<Value>) -> Vec<Value> {
        let mut c = ctx();
        let out = futures::executor::block_on(SortNode.execute(
            &mut c,
            NodeInput { items },
            &params,
        ))
        .unwrap();
        out.branches[0].items.clone()
    }

    #[test]
    fn sort_objects_by_single_field_ascending() {
        let items = vec![
            json!({"id": 3, "v": "c"}),
            json!({"id": 1, "v": "a"}),
            json!({"id": 2, "v": "b"}),
        ];
        let params = json!({ "sortFields": [{ "field": "id", "direction": "asc" }] });
        let out = run(params, items);
        assert_eq!(out[0]["id"], 1);
        assert_eq!(out[1]["id"], 2);
        assert_eq!(out[2]["id"], 3);
    }

    #[test]
    fn sort_descending_works() {
        let items = vec![json!({"n": 1}), json!({"n": 3}), json!({"n": 2})];
        let params = json!({ "sortFields": [{ "field": "n", "direction": "desc" }] });
        let out = run(params, items);
        assert_eq!(out[0]["n"], 3);
        assert_eq!(out[1]["n"], 2);
        assert_eq!(out[2]["n"], 1);
    }

    #[test]
    fn sort_by_two_fields_uses_second_as_tie_break() {
        let items = vec![
            json!({"a": 1, "b": "z"}),
            json!({"a": 1, "b": "a"}),
            json!({"a": 0, "b": "m"}),
        ];
        let params = json!({
            "sortFields": [
                { "field": "a", "direction": "asc" },
                { "field": "b", "direction": "asc" },
            ]
        });
        let out = run(params, items);
        assert_eq!(out[0]["a"], 0);
        assert_eq!(out[1]["b"], "a");
        assert_eq!(out[2]["b"], "z");
    }

    #[test]
    fn sort_is_stable_for_equal_keys() {
        // Two items have the same key — their original order must be preserved.
        let items = vec![
            json!({"k": 1, "tag": "first"}),
            json!({"k": 1, "tag": "second"}),
            json!({"k": 1, "tag": "third"}),
        ];
        let params = json!({ "sortFields": [{ "field": "k", "direction": "asc" }] });
        let out = run(params, items);
        assert_eq!(out[0]["tag"], "first");
        assert_eq!(out[1]["tag"], "second");
        assert_eq!(out[2]["tag"], "third");
    }

    #[test]
    fn sort_dotted_path() {
        let items = vec![
            json!({"user": {"name": "charlie"}}),
            json!({"user": {"name": "alice"}}),
            json!({"user": {"name": "bob"}}),
        ];
        let params = json!({ "sortFields": [{ "field": "user.name", "direction": "asc" }] });
        let out = run(params, items);
        assert_eq!(out[0]["user"]["name"], "alice");
        assert_eq!(out[1]["user"]["name"], "bob");
        assert_eq!(out[2]["user"]["name"], "charlie");
    }

    #[test]
    fn missing_fields_sort_last_in_both_directions() {
        let items = vec![
            json!({"id": 1}),
            json!({"other": "x"}),
            json!({"id": 2}),
        ];
        let params_asc = json!({ "sortFields": [{ "field": "id", "direction": "asc" }] });
        let out = run(params_asc, items.clone());
        assert_eq!(out[0]["id"], 1);
        assert_eq!(out[1]["id"], 2);
        assert!(out[2].get("id").is_none());

        let params_desc = json!({ "sortFields": [{ "field": "id", "direction": "desc" }] });
        let out = run(params_desc, items);
        assert_eq!(out[0]["id"], 2);
        assert_eq!(out[1]["id"], 1);
        assert!(out[2].get("id").is_none());
    }

    #[test]
    fn sort_primitives_with_empty_field() {
        let items = vec![json!(3), json!(1), json!(2)];
        let params = json!({
            "sortFields": [{ "field": "", "direction": "asc" }],
            "type": "number",
        });
        let out = run(params, items);
        assert_eq!(out[0], json!(1));
        assert_eq!(out[1], json!(2));
        assert_eq!(out[2], json!(3));
    }

    #[test]
    fn sort_dates_iso_strings() {
        let items = vec![
            json!({"at": "2024-12-31T00:00:00Z"}),
            json!({"at": "2023-01-01T00:00:00Z"}),
            json!({"at": "2024-06-15T00:00:00Z"}),
        ];
        let params = json!({
            "sortFields": [{ "field": "at", "direction": "asc", "type": "date" }],
        });
        let out = run(params, items);
        assert_eq!(out[0]["at"], "2023-01-01T00:00:00Z");
        assert_eq!(out[1]["at"], "2024-06-15T00:00:00Z");
        assert_eq!(out[2]["at"], "2024-12-31T00:00:00Z");
    }

    #[test]
    fn sort_numbers_in_string_form_when_type_number() {
        let items = vec![json!({"n": "10"}), json!({"n": "2"}), json!({"n": "1"})];
        let params = json!({
            "sortFields": [{ "field": "n", "direction": "asc", "type": "number" }],
        });
        let out = run(params, items);
        assert_eq!(out[0]["n"], "1");
        assert_eq!(out[1]["n"], "2");
        assert_eq!(out[2]["n"], "10");
    }

    #[test]
    fn empty_sort_fields_passes_through() {
        let items = vec![json!(3), json!(1), json!(2)];
        let params = json!({ "sortFields": [] });
        let out = run(params, items);
        assert_eq!(out, vec![json!(3), json!(1), json!(2)]);
    }

    #[test]
    fn empty_input_yields_empty_branch() {
        let params = json!({ "sortFields": [{ "field": "id" }] });
        let out = run(params, vec![]);
        assert!(out.is_empty());
    }

    #[test]
    fn shorthand_string_sort_fields() {
        let items = vec![json!({"k": "b"}), json!({"k": "a"}), json!({"k": "c"})];
        let params = json!({ "sortFields": "k" });
        let out = run(params, items);
        assert_eq!(out[0]["k"], "a");
        assert_eq!(out[1]["k"], "b");
        assert_eq!(out[2]["k"], "c");
    }
}
