//! IF node — n8n parity (`n8n-nodes-base.if`).
//!
//! Branches the incoming items into a `true` output (port 0) and a `false`
//! output (port 1) based on one or more conditions combined with AND/OR.
//! The left/right sides of each condition are evaluated through the
//! expression engine (`ExecutionContext::substitute`), so node authors can
//! write conditions like `{{$json.status}} === "open"` and have them resolve
//! against the in-flight item.
//!
//! ## Properties
//!
//! | name         | type    | description                                          |
//! |--------------|---------|------------------------------------------------------|
//! | `combinator` | options | `AND` (default) / `OR`                               |
//! | `conditions` | json    | array of `{ left, operator, right }` (default `[]`)  |
//!
//! ## Operators
//!
//! `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`,
//! `regex`, `greaterThan`, `lessThan`, `greaterThanEquals`, `lessThanEquals`,
//! `isEmpty`, `isNotEmpty`, `isTrue`, `isFalse`.
//!
//! Empty conditions list → every item routes to the `true` branch (no-op
//! gate). Matches n8n's behaviour for an unconfigured IF.

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

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: Value::String(value.to_string()),
        description: None,
    }
}

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
                        opt("AND (all must match)", "AND"),
                        opt("OR (any may match)", "OR"),
                    ])
                    .default(Value::String("AND".into())),
                NodeProperty::new("conditions", "Conditions", NodePropertyType::Json)
                    .description(
                        "Array of { left, operator, right } objects. Both sides may use \
                         {{var}} / {{$json.path}} expressions. Operators: equals, notEquals, \
                         contains, notContains, startsWith, endsWith, regex, greaterThan, \
                         lessThan, greaterThanEquals, lessThanEquals, isEmpty, isNotEmpty, \
                         isTrue, isFalse.",
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

        let conditions = match params.get("conditions").cloned() {
            Some(Value::Array(a)) => a,
            Some(Value::Null) | None => vec![],
            Some(other) => {
                return Err(NodeError::InvalidParameter {
                    name: "conditions".into(),
                    reason: format!("expected an array, got: {other}"),
                });
            }
        };

        let mut true_items: Vec<Value> = Vec::new();
        let mut false_items: Vec<Value> = Vec::new();

        for item in input.items {
            // No conditions configured → treat as a no-op pass-through to `true`.
            let matched = if conditions.is_empty() {
                true
            } else {
                evaluate_all(ctx, &conditions, is_and)?
            };

            if matched {
                true_items.push(item);
            } else {
                false_items.push(item);
            }
        }

        Ok(NodeOutput::multi(vec![true_items, false_items]))
    }
}

fn evaluate_all(ctx: &ExecutionContext, conditions: &[Value], is_and: bool) -> NodeResult<bool> {
    // AND short-circuits on first false; OR short-circuits on first true.
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
                return Ok(false);
            }
            matched = true;
        } else if pass {
            return Ok(true);
        } else {
            matched = false;
        }
    }
    Ok(matched)
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".into(),
            Arc::new(reqwest::Client::builder().build().unwrap()),
        )
    }

    #[tokio::test]
    async fn empty_conditions_route_all_to_true() {
        let mut c = ctx();
        let params = json!({});
        let input = NodeInput::many(vec![json!({"a": 1}), json!({"a": 2})]);
        let out = IfNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 2);
        assert_eq!(out.branches[1].items.len(), 0);
    }

    #[tokio::test]
    async fn and_combinator_requires_all() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"status": "ok", "score": "10"}));
        let params = json!({
            "combinator": "AND",
            "conditions": [
                { "left": "{{$json.status}}", "operator": "equals", "right": "ok" },
                { "left": "{{$json.score}}", "operator": "greaterThan", "right": "5" }
            ]
        });
        let input = NodeInput::one(json!({}));
        let out = IfNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 1, "matched true branch");
        assert_eq!(out.branches[1].items.len(), 0);
    }

    #[tokio::test]
    async fn or_combinator_passes_on_any() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"status": "ok", "score": "1"}));
        let params = json!({
            "combinator": "OR",
            "conditions": [
                { "left": "{{$json.status}}", "operator": "equals", "right": "ok" },
                { "left": "{{$json.score}}", "operator": "greaterThan", "right": "5" }
            ]
        });
        let input = NodeInput::one(json!({}));
        let out = IfNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 1);
    }

    #[tokio::test]
    async fn regex_operator_branches_correctly() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"email": "alice@example.com"}));
        let params = json!({
            "conditions": [
                { "left": "{{$json.email}}", "operator": "regex", "right": "^[^@]+@example\\.com$" }
            ]
        });
        let input = NodeInput::one(json!({}));
        let out = IfNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 1);
        assert_eq!(out.branches[1].items.len(), 0);
    }

    #[tokio::test]
    async fn unknown_operator_returns_invalid_parameter() {
        let mut c = ctx();
        let params = json!({
            "conditions": [
                { "left": "x", "operator": "wat", "right": "y" }
            ]
        });
        let input = NodeInput::one(json!({}));
        let err = IfNode.execute(&mut c, input, &params).await.unwrap_err();
        assert!(matches!(err, NodeError::InvalidParameter { ref name, .. } if name == "operator"));
    }
}
