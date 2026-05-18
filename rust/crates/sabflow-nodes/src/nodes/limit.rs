//! Limit node — `n8n-nodes-base.limit`.
//!
//! Truncates the input branch to at most `maxItems` items.
//!
//! Properties:
//!   - `maxItems` (number, required): how many items to keep. Negative
//!     values are coerced to 0.
//!   - `keep` (option): `firstItems` (default) or `lastItems`. Alias
//!     `keepFirstOrLast` is accepted for parity with the C.3 task spec
//!     and shorter `first` / `last` strings also work.
//!
//! Returns at most `maxItems` items from a single branch; if the input
//! already contains fewer items than the limit the input is returned
//! unchanged.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct LimitNode;

#[async_trait]
impl Node for LimitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "limit",
            "Limit",
            "Keep only the first or last N items",
            NodeCategory::Transform,
        )
        .icon("list-filter")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("maxItems", "Max Items", NodePropertyType::Number)
                .description("Maximum number of items to keep")
                .default(json!(1))
                .required(),
            NodeProperty::new("keep", "Keep", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "First Items".into(),
                        value: json!("firstItems"),
                        description: Some("Drop everything after the first N".into()),
                    },
                    NodePropertyOption {
                        name: "Last Items".into(),
                        value: json!("lastItems"),
                        description: Some("Drop everything before the last N".into()),
                    },
                ])
                .default(json!("firstItems")),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let max = parse_max_items(params)?;
        let keep_last = parse_keep_last(params);

        let items = input.items;

        if max == 0 {
            return Ok(NodeOutput::single(vec![]));
        }
        if items.len() <= max {
            return Ok(NodeOutput::single(items));
        }

        let out: Vec<Value> = if keep_last {
            items[items.len() - max..].to_vec()
        } else {
            items[..max].to_vec()
        };

        Ok(NodeOutput::single(out))
    }
}

fn parse_max_items(params: &Value) -> NodeResult<usize> {
    // Accept number or numeric string under either `maxItems` (n8n) or
    // `count` (forge / SDK shorthand).
    let raw = params
        .get("maxItems")
        .or_else(|| params.get("count"))
        .cloned()
        .unwrap_or(Value::Null);

    match raw {
        Value::Number(n) => {
            let v = n.as_f64().ok_or_else(|| NodeError::InvalidParameter {
                name: "maxItems".into(),
                reason: "expected a finite number".into(),
            })?;
            if v.is_nan() {
                return Err(NodeError::InvalidParameter {
                    name: "maxItems".into(),
                    reason: "got NaN".into(),
                });
            }
            Ok(v.max(0.0).floor() as usize)
        }
        Value::String(s) => {
            let parsed: f64 = s.trim().parse().map_err(|_| NodeError::InvalidParameter {
                name: "maxItems".into(),
                reason: format!("not a number: {s}"),
            })?;
            Ok(parsed.max(0.0).floor() as usize)
        }
        Value::Null => Err(NodeError::MissingParameter("maxItems".into())),
        other => Err(NodeError::InvalidParameter {
            name: "maxItems".into(),
            reason: format!("expected a number, got: {other}"),
        }),
    }
}

fn parse_keep_last(params: &Value) -> bool {
    // Accept either `keep` (n8n) or `keepFirstOrLast` (spec) for the same setting.
    let raw = params
        .get("keep")
        .or_else(|| params.get("keepFirstOrLast"))
        .and_then(|v| v.as_str())
        .unwrap_or("firstItems")
        .to_ascii_lowercase();
    matches!(raw.as_str(), "lastitems" | "last")
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
        let out = futures::executor::block_on(LimitNode.execute(
            &mut c,
            NodeInput { items },
            &params,
        ))
        .unwrap();
        out.branches[0].items.clone()
    }

    #[test]
    fn keeps_first_n_by_default() {
        let items = vec![json!(1), json!(2), json!(3), json!(4)];
        let params = json!({ "maxItems": 2 });
        assert_eq!(run(params, items), vec![json!(1), json!(2)]);
    }

    #[test]
    fn keeps_last_n_when_requested() {
        let items = vec![json!(1), json!(2), json!(3), json!(4)];
        let params = json!({ "maxItems": 2, "keep": "lastItems" });
        assert_eq!(run(params, items), vec![json!(3), json!(4)]);
    }

    #[test]
    fn keep_first_or_last_alias_works() {
        let items = vec![json!(1), json!(2), json!(3), json!(4)];
        let params = json!({ "maxItems": 2, "keepFirstOrLast": "last" });
        assert_eq!(run(params, items), vec![json!(3), json!(4)]);
    }

    #[test]
    fn limit_greater_than_input_returns_all() {
        let items = vec![json!(1), json!(2)];
        let params = json!({ "maxItems": 10 });
        assert_eq!(run(params, items), vec![json!(1), json!(2)]);
    }

    #[test]
    fn zero_limit_returns_empty() {
        let items = vec![json!(1), json!(2), json!(3)];
        let params = json!({ "maxItems": 0 });
        assert!(run(params, items).is_empty());
    }

    #[test]
    fn negative_limit_clamps_to_zero() {
        let items = vec![json!(1), json!(2), json!(3)];
        let params = json!({ "maxItems": -5 });
        assert!(run(params, items).is_empty());
    }

    #[test]
    fn string_limit_parses_as_number() {
        let items = vec![json!(1), json!(2), json!(3), json!(4)];
        let params = json!({ "maxItems": "2" });
        assert_eq!(run(params, items), vec![json!(1), json!(2)]);
    }

    #[test]
    fn count_param_alias_works() {
        let items = vec![json!("a"), json!("b"), json!("c")];
        let params = json!({ "count": 1, "keep": "lastItems" });
        assert_eq!(run(params, items), vec![json!("c")]);
    }

    #[test]
    fn empty_input_returns_empty() {
        let params = json!({ "maxItems": 3 });
        assert!(run(params, vec![]).is_empty());
    }

    #[test]
    fn missing_max_items_errors() {
        let mut c = ctx();
        let params = json!({});
        let err = futures::executor::block_on(LimitNode.execute(
            &mut c,
            NodeInput { items: vec![json!(1)] },
            &params,
        ))
        .unwrap_err();
        match err {
            NodeError::MissingParameter(p) => assert_eq!(p, "maxItems"),
            other => panic!("expected MissingParameter(maxItems), got {other:?}"),
        }
    }

    #[test]
    fn fractional_limit_floors() {
        let items = vec![json!(1), json!(2), json!(3), json!(4)];
        let params = json!({ "maxItems": 2.9 });
        assert_eq!(run(params, items), vec![json!(1), json!(2)]);
    }

    #[test]
    fn preserves_complex_items() {
        let items = vec![
            json!({"id": 1, "tag": "a"}),
            json!({"id": 2, "tag": "b"}),
            json!({"id": 3, "tag": "c"}),
        ];
        let params = json!({ "maxItems": 2 });
        let out = run(params, items);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0]["id"], 1);
        assert_eq!(out[1]["id"], 2);
    }
}
