//! FunctionItem node — `n8n-nodes-base.functionItem`.
//!
//! Phase C.3.4 — per-item flavour of the legacy `Function` node (C.3.2).
//!
//! Like the JS path of [`super::code`], this node would run user-supplied
//! JavaScript inside the worker — once per input item. The sandbox required
//! to execute arbitrary JS safely is **not yet implemented**, so this node
//! currently returns the typed
//! [`super::code::JS_NOT_YET_SUPPORTED`] error.
//!
//! When a caller sets `continueOnFail = true` we emit one
//! `{ error: "function.js_not_yet_supported" }` item per incoming item rather
//! than aborting the workflow — that way downstream nodes still see the
//! per-item cardinality contract `FunctionItem` advertises.
//!
//! TODO(sabflow-sandbox): wire this to the same QuickJS / boa_engine sandbox
//! once it lands. Per-item semantics: each input item is bound to a fresh
//! `$json` / `item` global and the script's return value replaces the item.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
    nodes::code::JS_NOT_YET_SUPPORTED,
};

pub struct FunctionItemNode;

#[async_trait]
impl Node for FunctionItemNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "functionItem",
            "Function Item (legacy)",
            "Run JavaScript once per input item (sandbox not yet implemented)",
            NodeCategory::Developer,
        )
        .icon("function-square")
        .color("#f97316")
        .properties(vec![
            NodeProperty::new("functionCode", "Function Code", NodePropertyType::Code)
                .default(json!("// item.foo = 'bar';\nreturn item;"))
                .required()
                .description(
                    "JavaScript that runs once per input item. The current item is \
                     exposed as `item`. Not yet executable — returns a typed \
                     function.js_not_yet_supported error.",
                ),
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
        let continue_on_fail = ctx.param_bool(params, "continueOnFail", false);

        // Iterate per item so the failure shape mirrors a real per-item runtime
        // — `continueOnFail` swaps each item for its `{ error }` placeholder.
        let mut out = Vec::with_capacity(input.items.len().max(1));
        let items = if input.items.is_empty() {
            vec![Value::Null]
        } else {
            input.items
        };

        for _item in items {
            let result = try_with_continue_on_fail(continue_on_fail, || {
                Err(NodeError::ExpressionError(JS_NOT_YET_SUPPORTED.to_string()))
            })?;
            out.push(result);
        }

        Ok(NodeOutput::single(out))
    }
}

/// Tiny inline `try_with_continue_on_fail` shim — stand-in for the
/// `item_helpers::try_with_continue_on_fail` helper called out in the C.3.4
/// spec until that module lands.
fn try_with_continue_on_fail<F>(continue_on_fail: bool, f: F) -> NodeResult<Value>
where
    F: FnOnce() -> NodeResult<Value>,
{
    match f() {
        Ok(v) => Ok(v),
        Err(e) if continue_on_fail => Ok(json!({ "error": e.to_string() })),
        Err(e) => Err(e),
    }
}
