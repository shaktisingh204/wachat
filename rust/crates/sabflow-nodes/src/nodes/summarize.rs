//! Summarize node — `n8n-nodes-base.summarize`.
//!
//! Group + reduce. For each combination of `fieldsToGroupBy` values, emit one
//! output item whose fields are the configured aggregate-field results.
//! Mirrors n8n's V2 Summarize node (descendant of the ItemLists `summarize`
//! action).
//!
//! Per-field aggregations (`aggregation`):
//!
//! * `count`       — count of items in the group (non-null when
//!                   `includeEmpty=false`).
//! * `sum`         — sum of numeric values.
//! * `min` / `max` — extremum of numeric values.
//! * `average`     — mean of numeric values (alias `avg`).
//! * `concatenate` — string-join values with `separator` (default `,`).
//! * `countUnique` — distinct value count.
//! * `append`      — collect every value into an array (n8n shows it as
//!                   "Append" in the V2 picker).
//!
//! Numeric ops skip non-numeric entries. `concatenate` and `append` stringify
//! using JSON canonical form for non-string values, matching n8n.
//!
//! The output is **one item per group**.  When no group-by fields are
//! configured we emit a single rolled-up item across all inputs (n8n's
//! "no group" path).  Group key values are preserved on the output item
//! under their original field names so downstream pivot operations work.
//!
//! Each emitted item carries an n8n-shape `pairedItem` array listing every
//! contributing source index, preserving lineage for the editor.
//!
//! Forge port: `src/lib/sabflow/forge/blocks/n8n/transform/summarize.ts`.
//! n8n reference:
//! `n8n-master/packages/nodes-base/nodes/Transform/Summarize/Summarize.node.ts`.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SummarizeNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SummarizeNode {
    fn descriptor(&self) -> NodeDescriptor {
        let mut fields_to_summarize =
            NodeProperty::new("fieldsToSummarize", "Fields To Summarize", NodePropertyType::Collection)
                .description("List of per-field aggregations to apply");
        fields_to_summarize.children = vec![
            NodeProperty::new("aggregation", "Aggregation", NodePropertyType::Options)
                .options(vec![
                    opt("Count", "count"),
                    opt("Count Unique", "countUnique"),
                    opt("Sum", "sum"),
                    opt("Average", "average"),
                    opt("Min", "min"),
                    opt("Max", "max"),
                    opt("Concatenate", "concatenate"),
                    opt("Append", "append"),
                ])
                .default(json!("count"))
                .required(),
            NodeProperty::new("field", "Field", NodePropertyType::String)
                .placeholder("price")
                .required(),
            NodeProperty::new(
                "includeEmpty",
                "Include Empty Values",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("Count null / missing entries in `count` mode"),
            NodeProperty::new("separator", "Separator", NodePropertyType::String)
                .placeholder(",")
                .description("Used by `concatenate`"),
        ];

        let mut fields_to_group_by =
            NodeProperty::new("fieldsToGroupBy", "Fields To Group By", NodePropertyType::Collection)
                .description("Items are bucketed by the tuple of these fields' values");
        fields_to_group_by.children = vec![
            NodeProperty::new("field", "Field", NodePropertyType::String)
                .placeholder("category")
                .required(),
        ];

        NodeDescriptor::new(
            "summarize",
            "Summarize",
            "Group items and compute per-group aggregate stats",
            NodeCategory::Transform,
        )
        .icon("sigma")
        .color("#0ea5e9")
        .properties(vec![
            fields_to_summarize,
            fields_to_group_by,
            NodeProperty::new(
                "disableDotNotation",
                "Disable Dot Notation",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("If true, field names containing dots are treated literally"),
            NodeProperty::new(
                "continueIfFieldNotFound",
                "Continue If Field Not Found",
                NodePropertyType::Boolean,
            )
            .default(json!(true))
            .description("If false, throw when a summarized field is missing from any item"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let disable_dot = ctx.param_bool(params, "disableDotNotation", false);
        let continue_missing = ctx.param_bool(params, "continueIfFieldNotFound", true);

        // Parse the aggregations table.
        let agg_entries: Vec<Value> = params
            .get("fieldsToSummarize")
            .map(|v| match v {
                Value::Array(a) => a.clone(),
                Value::Object(o) => vec![Value::Object(o.clone())],
                _ => vec![],
            })
            .unwrap_or_default();
        let aggs: Vec<AggSpec> = agg_entries
            .iter()
            .filter_map(|e| AggSpec::from_value(e, &*ctx))
            .collect();

        if aggs.is_empty() {
            return Err(NodeError::MissingParameter("fieldsToSummarize".into()));
        }

        // Parse the group-by table.
        let group_entries: Vec<Value> = params
            .get("fieldsToGroupBy")
            .map(|v| match v {
                Value::Array(a) => a.clone(),
                Value::Object(o) => vec![Value::Object(o.clone())],
                _ => vec![],
            })
            .unwrap_or_default();
        let group_fields: Vec<String> = group_entries
            .iter()
            .filter_map(|e| {
                e.get("field")
                    .and_then(|v| v.as_str())
                    .map(|s| ctx.substitute(s))
                    .filter(|s| !s.is_empty())
            })
            .collect();

        let items = input.items;

        // Bucket items by the tuple of group-key values.
        // We preserve insertion order so output matches the order the first
        // representative of each group appeared in the input — same as n8n.
        let mut groups: Vec<Group> = Vec::new();
        for (idx, item) in items.iter().enumerate() {
            let key: Vec<Value> = group_fields
                .iter()
                .map(|f| read_field(item, f, disable_dot).cloned().unwrap_or(Value::Null))
                .collect();
            if let Some(g) = groups.iter_mut().find(|g| g.key == key) {
                g.indices.push(idx);
            } else {
                groups.push(Group {
                    key,
                    indices: vec![idx],
                });
            }
        }

        // If there were no items, emit a single empty summary row so downstream
        // nodes still get a tick — mirrors n8n's "no input" emit.
        if groups.is_empty() {
            groups.push(Group {
                key: group_fields.iter().map(|_| Value::Null).collect(),
                indices: vec![],
            });
        }

        let mut out_items: Vec<Value> = Vec::with_capacity(groups.len());
        for group in groups.iter() {
            let mut out = Map::new();

            // Carry the group-key values onto the output row.
            for (fname, kval) in group_fields.iter().zip(group.key.iter()) {
                out.insert(fname.clone(), kval.clone());
            }

            // Compute every aggregation against the items in this group.
            for spec in aggs.iter() {
                let mut numeric: Vec<f64> = Vec::new();
                let mut all_values: Vec<Value> = Vec::new();
                let mut unique: Vec<Value> = Vec::new();
                let mut missing_seen = false;

                for &i in group.indices.iter() {
                    let item = &items[i];
                    let v = read_field(item, &spec.field, disable_dot).cloned();
                    match v {
                        Some(Value::Null) | None => {
                            missing_seen = true;
                            if spec.include_empty {
                                all_values.push(Value::Null);
                                if !unique.iter().any(|u| u == &Value::Null) {
                                    unique.push(Value::Null);
                                }
                            }
                        }
                        Some(val) => {
                            if let Some(n) = to_f64(&val) {
                                numeric.push(n);
                            }
                            if !unique.iter().any(|u| u == &val) {
                                unique.push(val.clone());
                            }
                            all_values.push(val);
                        }
                    }
                }

                if missing_seen && !continue_missing {
                    return Err(NodeError::InvalidParameter {
                        name: "fieldsToSummarize".into(),
                        reason: format!("field '{}' missing from at least one item", spec.field),
                    });
                }

                let out_key = format!("{}_{}", spec.aggregation, spec.field);
                let result = match spec.aggregation.as_str() {
                    "count" => json!(all_values.len()),
                    "countUnique" => json!(unique.len()),
                    "sum" => json!(numeric.iter().sum::<f64>()),
                    "average" | "avg" => {
                        if numeric.is_empty() {
                            Value::Null
                        } else {
                            json!(numeric.iter().sum::<f64>() / numeric.len() as f64)
                        }
                    }
                    "min" => numeric
                        .iter()
                        .cloned()
                        .fold(None::<f64>, |acc, n| {
                            Some(acc.map_or(n, |a| a.min(n)))
                        })
                        .map(|n| json!(n))
                        .unwrap_or(Value::Null),
                    "max" => numeric
                        .iter()
                        .cloned()
                        .fold(None::<f64>, |acc, n| {
                            Some(acc.map_or(n, |a| a.max(n)))
                        })
                        .map(|n| json!(n))
                        .unwrap_or(Value::Null),
                    "concatenate" => {
                        let sep = if spec.separator.is_empty() {
                            ","
                        } else {
                            spec.separator.as_str()
                        };
                        let parts: Vec<String> =
                            all_values.iter().map(value_to_string).collect();
                        Value::String(parts.join(sep))
                    }
                    "append" => Value::Array(all_values),
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "aggregation".into(),
                            reason: format!("unknown aggregation: {other}"),
                        });
                    }
                };
                out.insert(out_key, result);
            }

            // Lineage: every contributing input row.
            let paired: Vec<Value> =
                group.indices.iter().map(|i| json!({ "item": i })).collect();
            out.insert("pairedItem".into(), Value::Array(paired));

            out_items.push(Value::Object(out));
        }

        Ok(NodeOutput::single(out_items))
    }
}

#[derive(Debug, Clone)]
struct AggSpec {
    aggregation: String,
    field: String,
    include_empty: bool,
    separator: String,
}

impl AggSpec {
    fn from_value(v: &Value, ctx: &ExecutionContext) -> Option<Self> {
        let aggregation = v
            .get("aggregation")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "count".to_string());
        let field = v
            .get("field")
            .and_then(|x| x.as_str())
            .map(|s| ctx.substitute(s))
            .unwrap_or_default();
        if field.is_empty() && aggregation != "count" {
            return None;
        }
        let include_empty = v.get("includeEmpty").and_then(|x| x.as_bool()).unwrap_or(false);
        let separator = v
            .get("separator")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();
        Some(Self {
            aggregation,
            field,
            include_empty,
            separator,
        })
    }
}

#[derive(Debug)]
struct Group {
    key: Vec<Value>,
    indices: Vec<usize>,
}

fn read_field<'a>(item: &'a Value, path: &str, disable_dot: bool) -> Option<&'a Value> {
    if disable_dot {
        item.get(path)
    } else {
        lookup_path(item, path)
    }
}

fn lookup_path<'a>(v: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(v);
    }
    let mut cur = v;
    for part in path.split('.') {
        cur = cur.get(part)?;
    }
    Some(cur)
}

fn to_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        Value::Bool(true) => Some(1.0),
        Value::Bool(false) => Some(0.0),
        _ => None,
    }
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}
