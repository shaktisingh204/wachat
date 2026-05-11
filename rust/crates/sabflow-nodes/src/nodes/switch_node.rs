//! Switch node — routes each incoming item to one of several output branches
//! based on a list of rules.
//!
//! Properties:
//!   - `mode`: "expression" | "rules" (default "rules")
//!   - `value`: String to switch on (supports `{{}}` interpolation)
//!   - `rules`: Json array of `{ operator, value, output }`
//!   - `fallbackOutput`: Number — branch index used when no rule matches (default 3)
//!
//! Operators (same family as IF):
//!   equals, notEquals, contains, notContains, startsWith, endsWith, regex,
//!   greaterThan, lessThan, greaterThanEquals, lessThanEquals, isEmpty, isNotEmpty.
//!
//! Descriptor advertises 4 fixed pins: ["0","1","2","fallback"].
//! The engine handles dynamic routing — we just emit a branch vec whose length
//! is at least `max(rule.output, fallbackOutput) + 1`.

use async_trait::async_trait;
use regex::Regex;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SwitchNode;

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
            output_names: vec![
                "0".to_string(),
                "1".to_string(),
                "2".to_string(),
                "fallback".to_string(),
            ],
            credentials: vec![],
            properties: vec![
                NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                    .options(vec![
                        NodePropertyOption {
                            name: "Rules".into(),
                            value: Value::String("rules".into()),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Expression".into(),
                            value: Value::String("expression".into()),
                            description: None,
                        },
                    ])
                    .default(Value::String("rules".into())),
                NodeProperty::new("value", "Value", NodePropertyType::String)
                    .description("Value to switch on. Supports {{var}} interpolation.")
                    .placeholder("{{ $json.status }}")
                    .show_when("mode", &["rules"]),
                NodeProperty::new("rules", "Rules", NodePropertyType::Json)
                    .description(
                        "Array of { operator, value, output } objects. Item is routed to the first matching rule's output index.",
                    )
                    .default(Value::Array(vec![]))
                    .show_when("mode", &["rules"]),
                NodeProperty::new("fallbackOutput", "Fallback Output", NodePropertyType::Number)
                    .description("Output index to use when no rule matches.")
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
        let fallback_output = params
            .get("fallbackOutput")
            .and_then(|v| v.as_i64())
            .unwrap_or(3)
            .max(0) as usize;

        let raw_value = ctx.param_str_opt(params, "value").unwrap_or_default();

        let rules_val = params
            .get("rules")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        let rules = match rules_val {
            Value::Array(a) => a,
            Value::Null => vec![],
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "rules".into(),
                    reason: format!("expected an array, got: {other}"),
                });
            }
        };

        // Compute the number of declared output branches: enough to fit every
        // rule.output and the fallback.
        let mut max_idx = fallback_output;
        for rule in &rules {
            if let Some(o) = rule.get("output").and_then(|v| v.as_i64()) {
                if o >= 0 && (o as usize) > max_idx {
                    max_idx = o as usize;
                }
            }
        }
        let branch_count = max_idx + 1;
        let mut branches: Vec<Vec<Value>> = vec![Vec::new(); branch_count];

        for item in input.items {
            let mut routed: Option<usize> = None;

            for rule in &rules {
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
                if evaluate(&raw_value, op, &right)? {
                    routed = Some(output_idx);
                    break;
                }
            }

            let dest = routed.unwrap_or(fallback_output);
            if dest < branches.len() {
                branches[dest].push(item);
            } else {
                // Should not happen given branch_count math, but stay safe.
                branches
                    .last_mut()
                    .expect("at least one branch declared")
                    .push(item);
            }
        }

        Ok(NodeOutput::multi(branches))
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
