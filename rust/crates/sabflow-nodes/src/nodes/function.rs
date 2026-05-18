//! Function node — `n8n-nodes-base.function` (legacy code node).
//!
//! ### TODO: full JS execution requires `sabflow-executor-expression`
//!
//! n8n's Function node embeds V8 and lets users write `return items.map(...)`.
//! SabFlow deliberately does NOT ship a separate JS runtime — every code
//! evaluation must go through the expression engine sandbox at
//! `rust/crates/sabflow-executor/expression/`. As of Phase C.3.2 that crate
//! is a scaffold (`placeholder()` only) — n8n-compatible expression
//! evaluation lands in a later Track B sub-phase.
//!
//! Until the sandbox exposes a `function-node-compatible` API, this node
//! ships as a thin stub that fails fast with the stable error code
//! `function.js_not_yet_supported`. Parity tests assert that:
//!
//! - n8n's Function node returns 200 with the JS executed.
//! - SabFlow's Function node returns a typed `InvalidParameter` whose
//!   `name` is `function.js_not_yet_supported`.
//!
//! Down the road, replace [`FunctionNode::execute`] with a call into the
//! expression-engine sandbox that exposes `items`, `$item`, `$node`,
//! `$workflow`, `$execution` per the n8n API surface, and returns the
//! transformed array.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

/// Stable error code emitted while the expression-engine JS sandbox is
/// still on the roadmap. Kept as a constant so parity-test fixtures can
/// pin the exact name they assert on.
pub const FUNCTION_JS_NOT_YET_SUPPORTED: &str = "function.js_not_yet_supported";

pub struct FunctionNode;

#[async_trait]
impl Node for FunctionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "function",
            "Function (legacy)",
            "Run a JavaScript snippet that receives `items` and returns the transformed array.",
            NodeCategory::Logic,
        )
        .icon("code")
        .color("#f97316")
        .properties(vec![
            NodeProperty::new("functionCode", "Function", NodePropertyType::Code)
                .default(Value::String(
                    "// items is the array of input items.\n\
                     // Return the new items.\n\
                     return items;"
                        .into(),
                ))
                .description(
                    "JavaScript source executed by the SabFlow expression engine. \
                     A `function (items)` body is expected; the return value becomes \
                     the next node's input. NOTE: requires the executor expression \
                     sandbox — currently unavailable, see TODO at the top of \
                     rust/crates/sabflow-nodes/src/nodes/function.rs.",
                )
                .required(),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Parity contract: n8n returns 200 with `items` transformed by the
        // user-supplied JS. SabFlow returns a typed error with the stable
        // code below. The parity fixture asserts this exact shape so we
        // can flip it to a real implementation later without churning the
        // test surface.
        Err(NodeError::InvalidParameter {
            name: FUNCTION_JS_NOT_YET_SUPPORTED.to_string(),
            reason:
                "the SabFlow expression-engine sandbox required for the Function node is not \
                 wired up yet — track via PLAN-sabflow-coverage.md Phase C.3.2."
                    .to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[tokio::test]
    async fn function_node_errors_with_stable_code() {
        let node = FunctionNode;
        let http = Arc::new(reqwest::Client::new());
        let mut ctx = ExecutionContext::new("test-exec".into(), http);
        let err = node
            .execute(
                &mut ctx,
                NodeInput::empty(),
                &serde_json::json!({ "functionCode": "return items;" }),
            )
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => {
                assert_eq!(name, FUNCTION_JS_NOT_YET_SUPPORTED);
            }
            other => panic!("expected InvalidParameter, got {other:?}"),
        }
    }

    #[test]
    fn function_node_descriptor_is_logic() {
        let d = FunctionNode.descriptor();
        assert_eq!(d.name, "function");
        assert!(matches!(d.category, NodeCategory::Logic));
        assert!(!d.stub, "function should be un-stubbed even though execute errors today");
    }
}
