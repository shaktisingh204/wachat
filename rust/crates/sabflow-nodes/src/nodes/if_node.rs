//! IF node — branches incoming items into `true` / `false` based on a set of
//! comparisons combined with AND/OR.
//!
//! Properties:
//!   - `combinator`: "AND" | "OR" (default "AND")
//!   - `conditions`: Json array of `{ left, operator, right }` objects.
//!
//! Output port 0 → items that matched. Port 1 → items that did not.

use async_trait::async_trait;
use regex::Regex;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct IfNode;

#[async_trait]
impl Node for IfNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor {
            name: "if".to_string(),
            display_name: "IF".to_string(),
            description: "Branch flow based on conditions".to_string(),
            category: NodeCategory::Logic,
            version: 1,
            icon: "git-branch".to_string(),
            color: "#a855f7".to_string(),
            is_trigger: false,
            inputs: 1,
            outputs: 2,
            output_names: vec!["true".to_string(), "false".to_string()],
            credentials: vec![],
            properties: vec![
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
                        "Array of { left, operator, right } objects. Operators: equals, notEquals, contains, notContains, startsWith, endsWith, regex, greaterThan, lessThan, greaterThanEquals, lessThanEquals, isEmpty, isNotEmpty, isTrue, isFalse.",
                    )
                    .default(Value::Array(vec![])),
            ],
            stub: false,
        }
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

        let mut true_items: Vec<Value> = Vec::new();
        let mut false_items: Vec<Value> = Vec::new();

        // If there are no items to filter, still emit two empty branches.
        if input.items.is_empty() {
            return Ok(NodeOutput::multi(vec![true_items, false_items]));
        }

        for item in input.items {
            // With no conditions, treat as `true` (no-op gate).
            let mut matched = if conditions.is_empty() { true } else { is_and };

            for cond in &conditions {
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

            if matched {
                true_items.push(item);
            } else {
                false_items.push(item);
            }
        }

        Ok(NodeOutput::multi(vec![true_items, false_items]))
    }
}

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
