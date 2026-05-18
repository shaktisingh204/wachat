//! Filter node — `n8n-nodes-base.filter`.
//!
//! Phase C.3.4 implementation.
//!
//! Filter is the single-output sibling of [`super::if_node::IfNode`]: it
//! evaluates the same `{ left, operator, right }` condition objects against
//! each incoming item, then emits **only** the items that matched. Items
//! that fail the predicate are dropped.
//!
//! Properties:
//!   - `combinator`: "AND" | "OR" (default "AND")
//!   - `conditions`: Json array of `{ left, operator, right }` objects.
//!     Operators are reused from `If`: equals, notEquals, contains,
//!     notContains, startsWith, endsWith, regex, greaterThan, lessThan,
//!     greaterThanEquals, lessThanEquals, isEmpty, isNotEmpty, isTrue,
//!     isFalse.
//!   - `continueOnFail`: when set, a per-item evaluation failure emits an
//!     `{ error }` item alongside the survivors instead of aborting the run.
//!
//! Behaviour notes:
//!   - Empty `conditions` → every item passes (no-op gate). This matches the
//!     `IfNode` short-circuit so users can wire a Filter, leave it blank, and
//!     still see items flow.
//!   - Output cardinality is "≤ input": this is a drop-filter, not a router.
//!     Use `If` when you also want the failed branch.

use async_trait::async_trait;
use regex::Regex;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct FilterNode;

#[async_trait]
impl Node for FilterNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "filter",
            "Filter",
            "Drop items that don't match a condition",
            NodeCategory::Transform,
        )
        .icon("filter")
        .color("#a855f7")
        .properties(vec![
            NodeProperty::new("combinator", "Combine", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "AND (all must match)".into(),
                        value: Value::String("AND".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "OR (any may match)".into(),
                        value: Value::String("OR".into()),
                        description: None,
                    },
                ])
                .default(Value::String("AND".into())),
            NodeProperty::new("conditions", "Conditions", NodePropertyType::Json)
                .description(
                    "Array of { left, operator, right } objects. Operators: equals, \
                     notEquals, contains, notContains, startsWith, endsWith, regex, \
                     greaterThan, lessThan, greaterThanEquals, lessThanEquals, isEmpty, \
                     isNotEmpty, isTrue, isFalse.",
                )
                .default(Value::Array(vec![])),
            NodeProperty::new("continueOnFail", "Continue on Fail", NodePropertyType::Boolean)
                .default(json!(false))
                .description(
                    "When enabled, per-item evaluation failures emit { error: \"...\" } \
                     items rather than aborting the workflow.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let combinator = ctx
            .param_str_opt(params, "combinator")
            .unwrap_or_else(|| "AND".to_string())
            .to_uppercase();
        let is_and = combinator != "OR";
        let continue_on_fail = ctx.param_bool(params, "continueOnFail", false);

        let conditions = params
            .get("conditions")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        let conditions = match conditions {
            Value::Array(a) => a,
            Value::Null => vec![],
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "conditions".into(),
                    reason: format!("expected an array, got: {other}"),
                });
            }
        };

        // No items → nothing to filter, still emit an empty branch.
        if input.items.is_empty() {
            return Ok(NodeOutput::single(vec![]));
        }

        let mut passed: Vec<Value> = Vec::with_capacity(input.items.len());

        for item in input.items {
            let matched = match item_matches(ctx, &item, &conditions, is_and) {
                Ok(b) => b,
                Err(e) if continue_on_fail => {
                    passed.push(json!({ "error": e.to_string() }));
                    continue;
                }
                Err(e) => return Err(e),
            };

            if matched {
                passed.push(item);
            }
        }

        Ok(NodeOutput::single(passed))
    }
}

/// Evaluate the combined predicate for one item against `conditions`. Mirrors
/// the AND/OR short-circuit logic in [`super::if_node::IfNode::execute`].
fn item_matches(
    ctx: &ExecutionContext,
    _item: &Value,
    conditions: &[Value],
    is_and: bool,
) -> NodeResult<bool> {
    if conditions.is_empty() {
        // No conditions = no-op gate, every item passes.
        return Ok(true);
    }

    let mut matched = is_and;

    for cond in conditions {
        let left_raw = cond.get("left").and_then(|v| v.as_str()).unwrap_or("");
        let op_raw = cond
            .get("operator")
            .and_then(|v| v.as_str())
            .unwrap_or("equals");
        let right_raw = cond.get("right").and_then(|v| v.as_str()).unwrap_or("");

        let left = ctx.substitute(left_raw);
        let right = ctx.substitute(right_raw);

        let pass = evaluate(&left, op_raw, &right)?;

        if is_and {
            if !pass {
                matched = false;
                break;
            }
        } else if pass {
            matched = true;
            break;
        } else {
            matched = false;
        }
    }

    Ok(matched)
}

/// Comparison operator dispatch — kept structurally identical to the table in
/// `if_node::evaluate` so the two nodes stay behaviourally aligned.
fn evaluate(left: &str, op: &str, right: &str) -> NodeResult<bool> {
    match op {
        "equals" => Ok(left == right),
        "notEquals" => Ok(left != right),
        "contains" => Ok(left.contains(right)),
        "notContains" => Ok(!left.contains(right)),
        "startsWith" => Ok(left.starts_with(right)),
        "endsWith" => Ok(left.ends_with(right)),
        "regex" => {
            let re = Regex::new(right).map_err(|e| NodeError::InvalidParameter {
                name: "right".into(),
                reason: format!("invalid regex `{right}`: {e}"),
            })?;
            Ok(re.is_match(left))
        }
        "greaterThan" => Ok(parse_num(left) > parse_num(right)),
        "lessThan" => Ok(parse_num(left) < parse_num(right)),
        "greaterThanEquals" => Ok(parse_num(left) >= parse_num(right)),
        "lessThanEquals" => Ok(parse_num(left) <= parse_num(right)),
        "isEmpty" => Ok(left.is_empty()),
        "isNotEmpty" => Ok(!left.is_empty()),
        "isTrue" => Ok(matches!(
            left.trim().to_ascii_lowercase().as_str(),
            "true" | "1" | "yes"
        )),
        "isFalse" => Ok(matches!(
            left.trim().to_ascii_lowercase().as_str(),
            "false" | "0" | "no" | ""
        )),
        other => Err(NodeError::InvalidParameter {
            name: "operator".into(),
            reason: format!("unknown operator: {other}"),
        }),
    }
}

fn parse_num(s: &str) -> f64 {
    s.trim().parse::<f64>().unwrap_or(f64::NAN)
}
