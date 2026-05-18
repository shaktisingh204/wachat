//! Filter node — keep only items whose JSON field matches a condition.
//!
//! Mirrors n8n's `n8n-nodes-base.filter` with a simplified single-condition
//! interface (n8n's combinator UI is rendered as a `combinator` enum so we
//! can extend to multi-condition without breaking serialized flows).
//!
//! Operators are typed: numeric comparisons coerce both sides to `f64`,
//! string comparisons coerce both sides via `Value::to_string` minus the
//! surrounding quotes, and `isEmpty` / `isNotEmpty` short-circuit before
//! parsing the comparison value.
//!
//! Pure local computation; no HTTP.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct FilterNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn value_at_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(root);
    }
    let mut cur = root;
    for segment in path.split('.') {
        if segment.is_empty() {
            continue;
        }
        cur = cur.get(segment)?;
    }
    Some(cur)
}

fn as_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn is_empty(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::String(s) => s.is_empty(),
        Value::Array(a) => a.is_empty(),
        Value::Object(o) => o.is_empty(),
        _ => false,
    }
}

fn matches(lhs: &Value, operator: &str, rhs_raw: &str) -> NodeResult<bool> {
    Ok(match operator {
        "isEmpty" => is_empty(lhs),
        "isNotEmpty" => !is_empty(lhs),
        "equals" => as_string(lhs) == rhs_raw,
        "notEquals" => as_string(lhs) != rhs_raw,
        "contains" => as_string(lhs).contains(rhs_raw),
        "notContains" => !as_string(lhs).contains(rhs_raw),
        "startsWith" => as_string(lhs).starts_with(rhs_raw),
        "endsWith" => as_string(lhs).ends_with(rhs_raw),
        "gt" | "gte" | "lt" | "lte" => {
            let l = as_f64(lhs).ok_or_else(|| NodeError::InvalidParameter {
                name: "value1".into(),
                reason: "left side is not numeric".into(),
            })?;
            let r = rhs_raw
                .trim()
                .parse::<f64>()
                .map_err(|_| NodeError::InvalidParameter {
                    name: "value2".into(),
                    reason: "right side is not numeric".into(),
                })?;
            match operator {
                "gt" => l > r,
                "gte" => l >= r,
                "lt" => l < r,
                "lte" => l <= r,
                _ => unreachable!(),
            }
        }
        other => {
            return Err(NodeError::InvalidParameter {
                name: "operator".into(),
                reason: format!("unknown operator: {other}"),
            });
        }
    })
}

#[async_trait]
impl Node for FilterNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "filter",
            "Filter",
            "Keep only items matching a condition",
            NodeCategory::Transform,
        )
        .icon("filter")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("fieldPath", "Field Path", NodePropertyType::String)
                .description("Dot-path into the item's JSON, e.g. `user.email`")
                .placeholder("status")
                .required(),
            NodeProperty::new("operator", "Operator", NodePropertyType::Options)
                .options(vec![
                    opt("Equals", "equals"),
                    opt("Not Equals", "notEquals"),
                    opt("Contains", "contains"),
                    opt("Not Contains", "notContains"),
                    opt("Starts With", "startsWith"),
                    opt("Ends With", "endsWith"),
                    opt("Greater Than", "gt"),
                    opt("Greater Than Or Equal", "gte"),
                    opt("Less Than", "lt"),
                    opt("Less Than Or Equal", "lte"),
                    opt("Is Empty", "isEmpty"),
                    opt("Is Not Empty", "isNotEmpty"),
                ])
                .default(json!("equals"))
                .required(),
            NodeProperty::new("compareValue", "Value", NodePropertyType::String)
                .description("Right-hand side of the comparison")
                .placeholder("active"),
            NodeProperty::new("invert", "Invert", NodePropertyType::Boolean)
                .description("Keep items that do NOT match instead")
                .default(json!(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let field_path = ctx.param_str(params, "fieldPath")?;
        let operator = ctx.param_str(params, "operator")?;
        let compare_value = ctx.param_str_opt(params, "compareValue").unwrap_or_default();
        let invert = ctx.param_bool(params, "invert", false);

        let mut kept: Vec<Value> = Vec::with_capacity(input.items.len());
        for item in input.items.into_iter() {
            let lhs = value_at_path(&item, &field_path).cloned().unwrap_or(Value::Null);
            let mut keep = matches(&lhs, &operator, &compare_value)?;
            if invert {
                keep = !keep;
            }
            if keep {
                kept.push(item);
            }
        }

        Ok(NodeOutput::single(kept))
    }
}
