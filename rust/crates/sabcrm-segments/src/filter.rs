//! Records-filter AST for SabCRM saved segments — Twenty-parity.
//!
//! A segment stores a **records-filter AST** per object: a tree of typed leaf
//! conditions (`field` / `op` / `value`) combined by `AND` / `OR` groups. This
//! module is the Rust mirror of the frontend filter shape in
//! `src/lib/sabcrm/records-filter.ts`, so the AST round-trips **losslessly**
//! across the wire:
//!
//! - the operator vocabulary is identical (`eq` | `neq` | `contains` |
//!   `notContains` | `gt` | `gte` | `lt` | `lte` | `in` | `notIn` | `isEmpty` |
//!   `isNotEmpty`), serialized as the same camelCase strings;
//! - a leaf is `{ "field", "op", "value"? }` (matching `FilterCondition`);
//! - a group is `{ "op": "and" | "or", "conditions": [ <node>, ... ] }` where
//!   each node is itself a leaf **or** a nested group.
//!
//! Because the AST is `#[serde(untagged)]` over the leaf/group split and every
//! field that the frontend omits is optional here, a value produced by the TS
//! side deserializes into [`FilterNode`] and re-serializes byte-equivalently
//! (modulo key ordering) — the lossless round-trip the segment surface needs.
//!
//! The same module owns [`node_to_mongo`], the AST → Mongo translation used by
//! the apply-segment endpoint. It mirrors `conditionToMongo` /
//! `buildFilter` in `records-filter.ts` exactly (same operator semantics:
//! `contains` is a case-insensitive escaped-regex substring match, `isEmpty`
//! matches `null` / `""` / missing, `in` / `notIn` coerce a scalar to a
//! single-element array, value-less comparison operators are dropped as
//! no-ops) and is intentionally additive — it does not touch the verbatim
//! storage path.

use bson::{Bson, Document, doc};
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Per-field filter operators. Mirrors `FilterOperator` in
/// `src/lib/sabcrm/records-filter.ts` 1:1 (same camelCase wire strings) so the
/// AST round-trips losslessly with the frontend filter shape.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum FilterOperator {
    #[serde(rename = "eq")]
    Eq,
    #[serde(rename = "neq")]
    Neq,
    #[serde(rename = "contains")]
    Contains,
    #[serde(rename = "notContains")]
    NotContains,
    #[serde(rename = "gt")]
    Gt,
    #[serde(rename = "gte")]
    Gte,
    #[serde(rename = "lt")]
    Lt,
    #[serde(rename = "lte")]
    Lte,
    #[serde(rename = "in")]
    In,
    #[serde(rename = "notIn")]
    NotIn,
    #[serde(rename = "isEmpty")]
    IsEmpty,
    #[serde(rename = "isNotEmpty")]
    IsNotEmpty,
}

impl FilterOperator {
    /// `true` for the operators that need a caller-supplied `value`. Mirrors
    /// `OPERATORS_REQUIRING_VALUE` in `records-filter.ts`. `in` / `notIn` are
    /// included here but, like the TS side, tolerate a scalar (coerced to a
    /// one-element array) so they are not dropped when given a bare value.
    fn requires_value(self) -> bool {
        !matches!(self, FilterOperator::IsEmpty | FilterOperator::IsNotEmpty)
    }

    /// `true` for the array-bearing operators that accept a scalar by coercing
    /// it to a single-element array (mirrors the `Array.isArray(value) ? … : [value]`
    /// fallback in `conditionToMongo`).
    fn is_set_op(self) -> bool {
        matches!(self, FilterOperator::In | FilterOperator::NotIn)
    }
}

/// Logical connective for a [`FilterGroup`]. Mirrors the `and` | `or` discriminant
/// the frontend uses for nested groups.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum LogicalOperator {
    And,
    Or,
}

/// A single typed condition against one field of the active object. Mirrors
/// `FilterCondition` in `records-filter.ts`: `{ field, op, value? }`. `value`
/// is required for every operator except `isEmpty` / `isNotEmpty`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct FilterCondition {
    /// Field key (or `createdAt` / `updatedAt`).
    pub field: String,
    /// The comparison operator.
    pub op: FilterOperator,
    /// Operand — required for every operator except `isEmpty` / `isNotEmpty`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub value: Option<Value>,
}

/// A nested AND / OR group of filter nodes. Mirrors the frontend group shape
/// `{ op: "and" | "or", conditions: [...] }` where each element of `conditions`
/// is itself a leaf or another group.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct FilterGroup {
    /// The group's logical connective.
    pub op: LogicalOperator,
    /// Child nodes — leaves and/or nested groups.
    pub conditions: Vec<FilterNode>,
}

/// One node of the records-filter AST — either a leaf [`FilterCondition`] or a
/// nested [`FilterGroup`]. `#[serde(untagged)]` makes the split structural (a
/// node with a `conditions` array is a group; one with a bare `op` + `field`
/// is a leaf), matching how the frontend encodes the tree and keeping the
/// round-trip lossless.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum FilterNode {
    /// A nested AND / OR group. Listed first so a `{ op, conditions }` object
    /// is decoded as a group rather than mis-parsed as a leaf.
    Group(FilterGroup),
    /// A leaf field condition.
    Condition(FilterCondition),
}

impl FilterNode {
    /// Convenience constructor for a leaf condition.
    pub fn condition(field: impl Into<String>, op: FilterOperator, value: Option<Value>) -> Self {
        FilterNode::Condition(FilterCondition {
            field: field.into(),
            op,
            value,
        })
    }
}

/// The Mongo document path a queryable field key maps onto. Mirrors `fieldPath`
/// in `records-filter.ts`: the two audit columns live at the top level, every
/// other field under `data.<key>`.
fn field_path(field: &str) -> String {
    if field == "createdAt" || field == "updatedAt" {
        field.to_owned()
    } else {
        format!("data.{field}")
    }
}

/// Escape every RegExp metacharacter in `input`. Mirrors `escapeRegExp` in
/// `records-filter.ts` so `contains` / `notContains` patterns are matched
/// literally.
fn escape_regex(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(
            ch,
            '.' | '*' | '+' | '?' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\'
        ) {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

/// Render a `serde_json::Value` operand as the string used by the
/// case-insensitive `contains` regex. Strings are used verbatim; other scalars
/// are stringified. Mirrors `String(value)` on the TS side.
fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Convert a JSON operand into BSON, surfacing a bad operand as a `400` rather
/// than a `500` (the value is client-controlled).
fn value_to_bson(v: &Value) -> Result<Bson> {
    bson::to_bson(v).map_err(|e| ApiError::BadRequest(format!("invalid filter value: {e}")))
}

/// `true` when an operand is "absent" for the purposes of dropping a value-less
/// comparison leaf — mirrors the `value === undefined || null || ""` guard in
/// `conditionToMongo`.
fn operand_is_blank(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

/// Translate one leaf [`FilterCondition`] into a Mongo predicate document
/// `{ "<path>": <expr> }`, or `None` when the condition is a no-op (blank field,
/// or a value-bearing comparison operator given no operand) — mirroring
/// `conditionToMongo` returning `null`.
fn condition_to_mongo(cond: &FilterCondition) -> Result<Option<Document>> {
    let field = cond.field.trim();
    if field.is_empty() {
        return Ok(None);
    }

    let op = cond.op;
    let value = cond.value.as_ref();

    // Value-less comparison operators (everything except in/notIn, which coerce
    // a scalar to an array) are no-ops rather than matching everything/nothing.
    if op.requires_value() && !op.is_set_op() && operand_is_blank(value) {
        return Ok(None);
    }

    let path = field_path(field);
    let null = Value::Null;
    let v = value.unwrap_or(&null);

    let expr: Bson = match op {
        FilterOperator::Eq => value_to_bson(v)?,
        FilterOperator::Neq => doc! { "$ne": value_to_bson(v)? }.into(),
        FilterOperator::Contains => doc! {
            "$regex": escape_regex(&value_to_string(v)),
            "$options": "i",
        }
        .into(),
        FilterOperator::NotContains => doc! {
            "$not": { "$regex": escape_regex(&value_to_string(v)), "$options": "i" },
        }
        .into(),
        FilterOperator::Gt => doc! { "$gt": value_to_bson(v)? }.into(),
        FilterOperator::Gte => doc! { "$gte": value_to_bson(v)? }.into(),
        FilterOperator::Lt => doc! { "$lt": value_to_bson(v)? }.into(),
        FilterOperator::Lte => doc! { "$lte": value_to_bson(v)? }.into(),
        FilterOperator::In => doc! { "$in": coerce_array(v)? }.into(),
        FilterOperator::NotIn => doc! { "$nin": coerce_array(v)? }.into(),
        FilterOperator::IsEmpty => doc! { "$in": [Bson::Null, Bson::String(String::new())] }.into(),
        FilterOperator::IsNotEmpty => doc! {
            "$exists": true,
            "$nin": [Bson::Null, Bson::String(String::new())],
        }
        .into(),
    };

    Ok(Some(doc! { path: expr }))
}

/// Coerce an operand into a BSON array, wrapping a scalar in a single-element
/// array (mirrors `Array.isArray(value) ? value : [value]`).
fn coerce_array(v: &Value) -> Result<Vec<Bson>> {
    match v {
        Value::Array(items) => items.iter().map(value_to_bson).collect(),
        other => Ok(vec![value_to_bson(other)?]),
    }
}

/// Translate a [`FilterGroup`] into a single Mongo `{ "$and" | "$or": [...] }`
/// document. No-op child nodes are skipped. An empty group (no usable children)
/// yields `None` so callers never emit an empty `$and` / `$or`, which Mongo
/// rejects.
fn group_to_mongo(group: &FilterGroup) -> Result<Option<Document>> {
    let mut branches: Vec<Bson> = Vec::with_capacity(group.conditions.len());
    for node in &group.conditions {
        if let Some(d) = node_to_mongo(node)? {
            branches.push(Bson::Document(d));
        }
    }
    if branches.is_empty() {
        return Ok(None);
    }
    // A single child collapses to itself — keeps the predicate shape tight and
    // avoids a pointless one-element `$and`/`$or`.
    if branches.len() == 1 {
        if let Some(Bson::Document(d)) = branches.into_iter().next() {
            return Ok(Some(d));
        }
        return Ok(None);
    }
    let key = match group.op {
        LogicalOperator::And => "$and",
        LogicalOperator::Or => "$or",
    };
    Ok(Some(doc! { key: branches }))
}

/// Translate one AST node into a Mongo predicate document, recursing through
/// nested groups. Returns `None` for a node that produces no usable predicate
/// (a no-op leaf or an empty group).
pub fn node_to_mongo(node: &FilterNode) -> Result<Option<Document>> {
    match node {
        FilterNode::Condition(c) => condition_to_mongo(c),
        FilterNode::Group(g) => group_to_mongo(g),
    }
}

/// Merge a translated AST predicate into a base tenant `filter`. The base
/// (`{ projectId, object }`) is preserved; the AST's top-level keys are folded
/// in. When the AST root is a single `$and` / `$or` it is wrapped so it cannot
/// clobber an existing operator key on `filter`. A `None` AST (empty / all
/// no-op) leaves `filter` untouched.
pub fn merge_node_into_filter(filter: &mut Document, node: Option<&FilterNode>) -> Result<()> {
    let Some(node) = node else { return Ok(()) };
    let Some(pred) = node_to_mongo(node)? else {
        return Ok(());
    };

    // If the predicate already carries a logical operator, AND it under the
    // tenant scope so we never overwrite `filter`'s own `$and`/`$or`.
    if pred.contains_key("$and") || pred.contains_key("$or") {
        merge_and_clause(filter, Bson::Document(pred));
        return Ok(());
    }

    // Otherwise fold each `data.<field>` predicate directly; on a key collision
    // (the same field appears at the root scope twice) demote to `$and`.
    for (k, v) in pred {
        if filter.contains_key(&k) {
            merge_and_clause(filter, Bson::Document(doc! { k: v }));
        } else {
            filter.insert(k, v);
        }
    }
    Ok(())
}

/// Append `clause` to `filter`'s top-level `$and`, creating it if absent and
/// folding any pre-existing scalar-but-conflicting state correctly.
fn merge_and_clause(filter: &mut Document, clause: Bson) {
    match filter.remove("$and") {
        Some(Bson::Array(mut existing)) => {
            existing.push(clause);
            filter.insert("$and", existing);
        }
        Some(other) => {
            filter.insert("$and", vec![other, clause]);
        }
        None => {
            filter.insert("$and", vec![clause]);
        }
    }
}

/// Parse a stored / supplied `filter` JSON value into a [`FilterNode`]. Accepts
/// any of the lossless frontend encodings:
///
/// - a group object `{ "op": "and" | "or", "conditions": [...] }`;
/// - a bare leaf `{ "field", "op", "value"? }`;
/// - an array of nodes (implicitly ANDed — wrapped in an AND group);
/// - `null` / absent → `None` (no predicate).
///
/// A non-conforming value yields a `400`.
pub fn parse_filter(value: Option<&Value>) -> Result<Option<FilterNode>> {
    let value = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(v) => v,
    };

    match value {
        // An array of nodes → an implicit AND group.
        Value::Array(_) => {
            let conditions: Vec<FilterNode> = serde_json::from_value(value.clone())
                .map_err(|e| ApiError::BadRequest(format!("invalid filter array: {e}")))?;
            if conditions.is_empty() {
                Ok(None)
            } else {
                Ok(Some(FilterNode::Group(FilterGroup {
                    op: LogicalOperator::And,
                    conditions,
                })))
            }
        }
        Value::Object(_) => {
            let node: FilterNode = serde_json::from_value(value.clone())
                .map_err(|e| ApiError::BadRequest(format!("invalid filter: {e}")))?;
            Ok(Some(node))
        }
        _ => Err(ApiError::BadRequest(
            "filter must be an object, array, or null.".to_owned(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn leaf_round_trips_losslessly() {
        let raw = json!({ "field": "name", "op": "contains", "value": "acme" });
        let node = parse_filter(Some(&raw)).unwrap().unwrap();
        let back = serde_json::to_value(&node).unwrap();
        assert_eq!(back, raw);
    }

    #[test]
    fn group_round_trips_losslessly() {
        let raw = json!({
            "op": "or",
            "conditions": [
                { "field": "stage", "op": "eq", "value": "won" },
                {
                    "op": "and",
                    "conditions": [
                        { "field": "amount", "op": "gte", "value": 1000 },
                        { "field": "name", "op": "isNotEmpty" }
                    ]
                }
            ]
        });
        let node = parse_filter(Some(&raw)).unwrap().unwrap();
        let back = serde_json::to_value(&node).unwrap();
        assert_eq!(back, raw);
    }

    #[test]
    fn isempty_omits_value_on_serialize() {
        let raw = json!({ "field": "email", "op": "isEmpty" });
        let node = parse_filter(Some(&raw)).unwrap().unwrap();
        assert_eq!(serde_json::to_value(&node).unwrap(), raw);
    }

    #[test]
    fn contains_translates_to_escaped_regex() {
        let node = FilterNode::condition("name", FilterOperator::Contains, Some(json!("a.b")));
        let d = node_to_mongo(&node).unwrap().unwrap();
        let inner = d.get_document("data.name").unwrap();
        assert_eq!(inner.get_str("$regex").unwrap(), "a\\.b");
        assert_eq!(inner.get_str("$options").unwrap(), "i");
    }

    #[test]
    fn in_coerces_scalar_to_array() {
        let node = FilterNode::condition("stage", FilterOperator::In, Some(json!("won")));
        let d = node_to_mongo(&node).unwrap().unwrap();
        let inner = d.get_document("data.stage").unwrap();
        let arr = inner.get_array("$in").unwrap();
        assert_eq!(arr.len(), 1);
    }

    #[test]
    fn blank_comparison_is_noop() {
        let node = FilterNode::condition("amount", FilterOperator::Gt, Some(json!("")));
        assert!(node_to_mongo(&node).unwrap().is_none());
    }

    #[test]
    fn audit_columns_are_top_level() {
        let node = FilterNode::condition("createdAt", FilterOperator::Gt, Some(json!("2024-01-01")));
        let d = node_to_mongo(&node).unwrap().unwrap();
        assert!(d.contains_key("createdAt"));
    }

    #[test]
    fn empty_group_is_noop() {
        let node = FilterNode::Group(FilterGroup {
            op: LogicalOperator::And,
            conditions: vec![],
        });
        assert!(node_to_mongo(&node).unwrap().is_none());
    }

    #[test]
    fn merge_preserves_tenant_scope() {
        let mut filter = doc! { "projectId": "p1", "object": "people" };
        let node = parse_filter(Some(&json!({
            "op": "and",
            "conditions": [
                { "field": "name", "op": "eq", "value": "Bob" },
                { "field": "city", "op": "eq", "value": "NYC" }
            ]
        })))
        .unwrap();
        merge_node_into_filter(&mut filter, node.as_ref()).unwrap();
        assert_eq!(filter.get_str("projectId").unwrap(), "p1");
        assert_eq!(filter.get_str("object").unwrap(), "people");
        // A multi-leaf AND group becomes a top-level `$and` ANDed under the
        // tenant scope (so it can never clobber the scope keys).
        let and = filter.get_array("$and").unwrap();
        assert_eq!(and.len(), 1);
        let inner = match &and[0] {
            Bson::Document(d) => d,
            other => panic!("expected document, got {other:?}"),
        };
        let branches = inner.get_array("$and").unwrap();
        assert_eq!(branches.len(), 2);
    }

    #[test]
    fn single_leaf_group_folds_field_at_root() {
        let mut filter = doc! { "projectId": "p1", "object": "people" };
        let node = parse_filter(Some(&json!({
            "op": "and",
            "conditions": [ { "field": "name", "op": "eq", "value": "Bob" } ]
        })))
        .unwrap();
        merge_node_into_filter(&mut filter, node.as_ref()).unwrap();
        // A single-leaf group collapses to its leaf, folded directly.
        assert!(filter.contains_key("data.name"));
        assert!(!filter.contains_key("$and"));
    }
}
