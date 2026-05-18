//! Aggregate node — `n8n-nodes-base.aggregate`.
//!
//! Collapses every input item into a **single** output item.  Mirrors n8n's
//! ItemLists-V2 → Aggregate variant (later promoted to its own node type).
//!
//! Two modes are supported, matching n8n's `aggregate` parameter:
//!
//! * **`aggregateAllItemData`** — emit one item whose configured `destinationFieldName`
//!   (default `data`) holds the full array of input items.  When
//!   `include` is `"specifiedFields"`, only those keys survive the copy;
//!   when `"allFieldsExcept"`, those keys are stripped first.
//!
//! * **`aggregateIndividualFields`** — for each `{ fieldToAggregate }` entry,
//!   emit a key on the output object whose value is the array of that
//!   field's value taken from every input item.  `disableDotNotation`
//!   controls whether the field path supports dotted lookup.
//!
//! The output item carries an n8n-shape `pairedItem` array
//! `[{ "item": i }, ...]` so the editor's lineage view continues to work —
//! every upstream item contributed.
//!
//! Forge port: `src/lib/sabflow/forge/blocks/n8n/transform/aggregate.ts`.
//! n8n reference: `n8n-master/packages/nodes-base/nodes/Transform/Aggregate/Aggregate.node.ts`.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct AggregateNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for AggregateNode {
    fn descriptor(&self) -> NodeDescriptor {
        let mut fields_to_aggregate =
            NodeProperty::new("fieldsToAggregate", "Fields To Aggregate", NodePropertyType::Collection)
                .description("List of fields to collect into per-field arrays");
        fields_to_aggregate.children = vec![
            NodeProperty::new("fieldToAggregate", "Input Field Name", NodePropertyType::String)
                .placeholder("price")
                .required(),
            NodeProperty::new("renameField", "Rename Field", NodePropertyType::Boolean)
                .default(json!(false))
                .description("If true, rename the output key"),
            NodeProperty::new("outputFieldName", "Output Field Name", NodePropertyType::String)
                .placeholder("prices"),
        ];

        NodeDescriptor::new(
            "aggregate",
            "Aggregate",
            "Roll a list of items into a single payload",
            NodeCategory::Transform,
        )
        .icon("layers")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("aggregate", "Aggregate", NodePropertyType::Options)
                .options(vec![
                    opt("Individual Fields", "aggregateIndividualFields"),
                    opt("All Item Data (Into a Single List)", "aggregateAllItemData"),
                ])
                .default(json!("aggregateIndividualFields"))
                .required(),
            // --- aggregateIndividualFields ---
            fields_to_aggregate.show_when("aggregate", &["aggregateIndividualFields"]),
            NodeProperty::new(
                "disableDotNotation",
                "Disable Dot Notation",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("If true, field names containing dots are treated literally")
            .show_when("aggregate", &["aggregateIndividualFields"]),
            NodeProperty::new(
                "mergeLists",
                "Merge Lists",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("If a field value is itself an array, flatten one level")
            .show_when("aggregate", &["aggregateIndividualFields"]),
            NodeProperty::new(
                "keepMissing",
                "Keep Missing And Null Values",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("Include null/undefined entries from items that lack the field")
            .show_when("aggregate", &["aggregateIndividualFields"]),
            // --- aggregateAllItemData ---
            NodeProperty::new(
                "destinationFieldName",
                "Put Output in Field",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .show_when("aggregate", &["aggregateAllItemData"]),
            NodeProperty::new("include", "Include", NodePropertyType::Options)
                .options(vec![
                    opt("All Fields", "allFields"),
                    opt("Specified Fields", "specifiedFields"),
                    opt("All Fields Except", "allFieldsExcept"),
                ])
                .default(json!("allFields"))
                .show_when("aggregate", &["aggregateAllItemData"]),
            NodeProperty::new("fieldsToInclude", "Fields To Include", NodePropertyType::String)
                .placeholder("id, name")
                .description("Comma-separated list of fields to keep")
                .show_when("include", &["specifiedFields"]),
            NodeProperty::new("fieldsToExclude", "Fields To Exclude", NodePropertyType::String)
                .placeholder("password, secret")
                .description("Comma-separated list of fields to drop")
                .show_when("include", &["allFieldsExcept"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let mode = ctx
            .param_str_opt(params, "aggregate")
            .unwrap_or_else(|| "aggregateIndividualFields".to_string());

        let items = input.items;
        // Lineage: every upstream item contributes.
        let paired = paired_item_list(items.len());

        match mode.as_str() {
            "aggregateAllItemData" => {
                let dest = ctx
                    .param_str_opt(params, "destinationFieldName")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "data".to_string());
                let include = ctx
                    .param_str_opt(params, "include")
                    .unwrap_or_else(|| "allFields".to_string());

                let arr: Vec<Value> = match include.as_str() {
                    "allFields" => items,
                    "specifiedFields" => {
                        let raw = ctx.param_str_opt(params, "fieldsToInclude").unwrap_or_default();
                        let keep = parse_field_list(&raw);
                        items
                            .into_iter()
                            .map(|it| pick_fields(it, &keep, true))
                            .collect()
                    }
                    "allFieldsExcept" => {
                        let raw = ctx.param_str_opt(params, "fieldsToExclude").unwrap_or_default();
                        let drop = parse_field_list(&raw);
                        items
                            .into_iter()
                            .map(|it| pick_fields(it, &drop, false))
                            .collect()
                    }
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "include".into(),
                            reason: format!("unknown include mode: {other}"),
                        });
                    }
                };

                let mut out = Map::new();
                out.insert(dest, Value::Array(arr));
                out.insert("pairedItem".into(), paired);
                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }

            "aggregateIndividualFields" => {
                let disable_dot = ctx.param_bool(params, "disableDotNotation", false);
                let merge_lists = ctx.param_bool(params, "mergeLists", false);
                let keep_missing = ctx.param_bool(params, "keepMissing", false);

                let entries: Vec<Value> = params
                    .get("fieldsToAggregate")
                    .map(|v| match v {
                        Value::Array(a) => a.clone(),
                        Value::Object(o) => vec![Value::Object(o.clone())],
                        _ => vec![],
                    })
                    .unwrap_or_default();

                if entries.is_empty() {
                    return Err(NodeError::MissingParameter("fieldsToAggregate".into()));
                }

                let mut out = Map::new();
                for entry in entries.iter() {
                    let Some(field) = entry
                        .get("fieldToAggregate")
                        .and_then(|v| v.as_str())
                        .map(|s| ctx.substitute(s))
                    else {
                        continue;
                    };
                    if field.is_empty() {
                        continue;
                    }
                    let rename = entry
                        .get("renameField")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let out_name = if rename {
                        entry
                            .get("outputFieldName")
                            .and_then(|v| v.as_str())
                            .map(|s| ctx.substitute(s))
                            .filter(|s| !s.is_empty())
                            .unwrap_or_else(|| field.clone())
                    } else {
                        field.clone()
                    };

                    let mut collected: Vec<Value> = Vec::with_capacity(items.len());
                    for item in items.iter() {
                        let v = if disable_dot {
                            item.get(field.as_str()).cloned()
                        } else {
                            lookup_path(item, &field).cloned()
                        };
                        match v {
                            Some(Value::Null) if !keep_missing => {}
                            None if !keep_missing => {}
                            Some(Value::Array(inner)) if merge_lists => {
                                collected.extend(inner);
                            }
                            Some(found) => collected.push(found),
                            None => collected.push(Value::Null),
                        }
                    }

                    out.insert(out_name, Value::Array(collected));
                }
                out.insert("pairedItem".into(), paired);
                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }

            other => Err(NodeError::InvalidParameter {
                name: "aggregate".into(),
                reason: format!("unknown aggregate mode: {other}"),
            }),
        }
    }
}

/// `[ { "item": 0 }, { "item": 1 }, ... ]` — n8n's IPairedItemData[] shape.
fn paired_item_list(n: usize) -> Value {
    Value::Array((0..n).map(|i| json!({ "item": i })).collect())
}

/// Parse `"a, b,c"` → `["a", "b", "c"]`.
fn parse_field_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Pick or drop top-level keys.  When `keep=true` we keep only `names`;
/// when `keep=false` we drop them.  Non-object items pass through.
fn pick_fields(item: Value, names: &[String], keep: bool) -> Value {
    let Value::Object(map) = item else {
        return item;
    };
    let mut out = Map::new();
    for (k, v) in map.into_iter() {
        let listed = names.iter().any(|n| n == &k);
        let take = if keep { listed } else { !listed };
        if take {
            out.insert(k, v);
        }
    }
    Value::Object(out)
}

/// Dotted-path lookup (e.g. `"user.address.city"`).
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
