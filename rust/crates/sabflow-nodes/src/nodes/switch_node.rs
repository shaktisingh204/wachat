//! Switch node — n8n parity (`n8n-nodes-base.switch`).
//!
//! Routes each incoming item to one of several output branches. Two modes:
//!
//! * `rules` — sequence of comparisons against `value`. The first matching
//!   rule's `output` index wins. Falls back to `fallbackOutput` if no rule
//!   matches.
//! * `expression` — `value` is interpreted directly as an integer-valued
//!   expression (e.g. `{{$json.routeIndex}}`). The integer it resolves to is
//!   the output index. Negative values or non-numeric results route to
//!   `fallbackOutput`.
//!
//! The descriptor advertises 4 fixed pins: `["0", "1", "2", "fallback"]`. At
//! runtime the actual branch vector is grown to fit the largest output index
//! the configured rules or expression can produce, so editors that draw more
//! pins than the descriptor declares are not lost.
//!
//! ## Operators (mirror the IF set)
//!
//! `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`,
//! `regex`, `greaterThan`, `lessThan`, `greaterThanEquals`, `lessThanEquals`,
//! `isEmpty`, `isNotEmpty`.

use async_trait::async_trait;
use regex::Regex;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SwitchNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: Value::String(value.to_string()),
        description: None,
    }
}

#[async_trait]
impl Node for SwitchNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor {
            name: "switch".to_string(),
            display_name: "Switch".to_string(),
            description: "Route items to one of several branches by value".to_string(),
            category: NodeCategory::Logic,
            version: 1,
            icon: "git-merge".to_string(),
            color: "#8b5cf6".to_string(),
            is_trigger: false,
            inputs: 1,
            outputs: 4,
            output_names: vec!["0".into(), "1".into(), "2".into(), "fallback".into()],
            credentials: vec![],
            properties: vec![
                NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                    .options(vec![opt("Rules", "rules"), opt("Expression", "expression")])
                    .default(Value::String("rules".into())),
                NodeProperty::new("value", "Value", NodePropertyType::String)
                    .description(
                        "In rules mode: the value compared against each rule. In expression \
                         mode: an integer-valued expression whose result IS the output index.",
                    )
                    .placeholder("{{ $json.status }}"),
                NodeProperty::new("rules", "Rules", NodePropertyType::Json)
                    .description(
                        "Array of { operator, value, output } objects. Item routes to the \
                         first matching rule's `output` index.",
                    )
                    .default(Value::Array(vec![]))
                    .show_when("mode", &["rules"]),
                NodeProperty::new(
                    "fallbackOutput",
                    "Fallback Output",
                    NodePropertyType::Number,
                )
                .description("Output index used when no rule matches / expression is invalid.")
                .default(Value::Number(serde_json::Number::from(3))),
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
        let mode = ctx
            .param_str_opt(params, "mode")
            .unwrap_or_else(|| "rules".to_string());

        let fallback_output = params
            .get("fallbackOutput")
            .and_then(|v| v.as_i64())
            .unwrap_or(3)
            .max(0) as usize;

        // The raw user-typed value (with substitution already applied by
        // `param_str_opt`). For expression mode it IS the integer index.
        let value = ctx.param_str_opt(params, "value").unwrap_or_default();

        match mode.as_str() {
            "expression" => {
                let branches_needed = fallback_output + 1;
                let mut branches: Vec<Vec<Value>> = vec![Vec::new(); branches_needed];
                for item in input.items {
                    let dest = parse_expression_index(&value).unwrap_or(fallback_output);
                    // Grow branches vec if the expression resolves past the
                    // currently-allocated length.
                    if dest >= branches.len() {
                        branches.resize(dest + 1, Vec::new());
                    }
                    branches[dest].push(item);
                }
                Ok(NodeOutput::multi(branches))
            }

            "rules" => {
                let rules = match params.get("rules").cloned() {
                    Some(Value::Array(a)) => a,
                    Some(Value::Null) | None => vec![],
                    Some(other) => {
                        return Err(NodeError::InvalidParameter {
                            name: "rules".into(),
                            reason: format!("expected an array, got: {other}"),
                        });
                    }
                };

                // Pre-size branches to accommodate the largest configured output
                // index PLUS the fallback. We grow defensively at insert time
                // anyway so this is only a perf optimisation.
                let mut max_idx = fallback_output;
                for rule in &rules {
                    if let Some(o) = rule.get("output").and_then(|v| v.as_i64()) {
                        if o >= 0 && (o as usize) > max_idx {
                            max_idx = o as usize;
                        }
                    }
                }
                let mut branches: Vec<Vec<Value>> = vec![Vec::new(); max_idx + 1];

                for item in input.items {
                    let dest = match_rules(ctx, &value, &rules)?.unwrap_or(fallback_output);
                    if dest >= branches.len() {
                        branches.resize(dest + 1, Vec::new());
                    }
                    branches[dest].push(item);
                }
                Ok(NodeOutput::multi(branches))
            }

            other => Err(NodeError::InvalidParameter {
                name: "mode".into(),
                reason: format!("unknown switch mode: {other}"),
            }),
        }
    }
}

/// Walk the rules; return the first matching output index.
fn match_rules(ctx: &ExecutionContext, value: &str, rules: &[Value]) -> NodeResult<Option<usize>> {
    for rule in rules {
        let op = rule
            .get("operator")
            .and_then(|v| v.as_str())
            .unwrap_or("equals");
        let right_raw = rule.get("value").and_then(|v| v.as_str()).unwrap_or("");
        let output_idx = rule
            .get("output")
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            .max(0) as usize;

        let right = ctx.substitute(right_raw);
        if evaluate(value, op, &right)? {
            return Ok(Some(output_idx));
        }
    }
    Ok(None)
}

/// Try to interpret the expression-mode `value` as an integer >= 0.
fn parse_expression_index(s: &str) -> Option<usize> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Allow either pure integer or float that rounds to a non-negative integer.
    if let Ok(n) = trimmed.parse::<i64>() {
        if n >= 0 {
            return Some(n as usize);
        }
        return None;
    }
    if let Ok(f) = trimmed.parse::<f64>() {
        if f.is_finite() && f >= 0.0 {
            return Some(f.trunc() as usize);
        }
    }
    None
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
                name: "value".into(),
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
    async fn rules_mode_routes_first_match() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"status": "open"}));
        let params = json!({
            "mode": "rules",
            "value": "{{$json.status}}",
            "fallbackOutput": 2,
            "rules": [
                { "operator": "equals", "value": "open",   "output": 0 },
                { "operator": "equals", "value": "closed", "output": 1 }
            ]
        });
        let input = NodeInput::one(json!({"any": true}));
        let out = SwitchNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[0].items.len(), 1, "routed to 0");
        assert_eq!(out.branches[1].items.len(), 0);
        assert_eq!(out.branches[2].items.len(), 0);
    }

    #[tokio::test]
    async fn rules_mode_falls_back_when_nothing_matches() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"status": "pending"}));
        let params = json!({
            "mode": "rules",
            "value": "{{$json.status}}",
            "fallbackOutput": 2,
            "rules": [
                { "operator": "equals", "value": "open",   "output": 0 },
                { "operator": "equals", "value": "closed", "output": 1 }
            ]
        });
        let input = NodeInput::one(json!({}));
        let out = SwitchNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[2].items.len(), 1, "routed to fallback");
    }

    #[tokio::test]
    async fn expression_mode_uses_value_as_index() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"routeIndex": 1}));
        let params = json!({
            "mode": "expression",
            "value": "{{$json.routeIndex}}",
            "fallbackOutput": 3
        });
        let input = NodeInput::one(json!({}));
        let out = SwitchNode.execute(&mut c, input, &params).await.unwrap();
        assert!(out.branches.len() >= 2);
        assert_eq!(out.branches[1].items.len(), 1);
    }

    #[tokio::test]
    async fn expression_mode_falls_back_on_invalid_index() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"routeIndex": "not-a-number"}));
        let params = json!({
            "mode": "expression",
            "value": "{{$json.routeIndex}}",
            "fallbackOutput": 2
        });
        let input = NodeInput::one(json!({}));
        let out = SwitchNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches[2].items.len(), 1);
    }

    #[tokio::test]
    async fn expression_mode_grows_branches_when_index_exceeds_fallback() {
        let mut c = ctx();
        c.trigger_data = Some(json!({"routeIndex": 7}));
        let params = json!({
            "mode": "expression",
            "value": "{{$json.routeIndex}}",
            "fallbackOutput": 3
        });
        let input = NodeInput::one(json!({}));
        let out = SwitchNode.execute(&mut c, input, &params).await.unwrap();
        assert_eq!(out.branches.len(), 8);
        assert_eq!(out.branches[7].items.len(), 1);
    }

    #[test]
    fn parse_expression_index_handles_floats_and_negatives() {
        assert_eq!(parse_expression_index("0"), Some(0));
        assert_eq!(parse_expression_index("3"), Some(3));
        assert_eq!(parse_expression_index("2.9"), Some(2));
        assert_eq!(parse_expression_index("-1"), None);
        assert_eq!(parse_expression_index("nan"), None);
        assert_eq!(parse_expression_index(""), None);
    }
}
