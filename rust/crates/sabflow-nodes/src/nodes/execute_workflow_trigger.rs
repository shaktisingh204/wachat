//! Execute Workflow Trigger node — `n8n-nodes-base.executeWorkflowTrigger`.
//!
//! The entry point of a **sub-workflow** invoked by an `Execute Workflow`
//! node (sibling C.3.8) somewhere in another flow. When the parent flow
//! calls `executeFlow(targetFlow, …)`, the engine seeds the run's
//! `ExecutionContext::trigger_data` with the parent's payload; this node
//! surfaces that payload as a single output item so the sub-workflow can
//! read the caller's inputs as `$json.<field>`.
//!
//! n8n parity: in n8n this node is registered as a "starting node type" —
//! `STARTING_NODE_TYPES` in `src/lib/sabflow/n8n/constants.ts` lists it
//! alongside `manualTrigger`. SabFlow treats it identically: zero inputs,
//! one output port, and the run starts here when called from a parent.
//!
//! When run from the editor directly (no caller payload) we emit an empty
//! item so the "Test step" UX still surfaces a single tick.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct ExecuteWorkflowTriggerNode;

#[async_trait]
impl Node for ExecuteWorkflowTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "executeWorkflowTrigger",
            "Execute Workflow Trigger",
            "Entry point when this workflow is invoked as a sub-workflow by another flow.",
            NodeCategory::Trigger,
        )
        .icon("workflow")
        .color("#a855f7")
        .trigger()
        .properties(vec![
            // Editor-only hint: a comma-separated list of input field names
            // the parent flow is expected to pass. Mirrors n8n's
            // `workflowInputs` declarative shape (loosened to a string here
            // since the editor renders the docs sidebar from it; the engine
            // doesn't validate against it).
            NodeProperty::new("inputSource", "Input Source", NodePropertyType::String)
                .default(Value::String("passthrough".into()))
                .description(
                    "How the sub-workflow consumes the parent's payload. \
                     `passthrough` (default) exposes every parent field as `$json.<name>`.",
                )
                .placeholder("passthrough"),
            NodeProperty::new("expectedInputs", "Expected Inputs", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Comma-separated list of input field names this sub-workflow expects. \
                     Editor-only hint — surfaced in the docs sidebar of the parent's \
                     Execute Workflow node.",
                )
                .placeholder("orderId, customerEmail"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Parent's payload (seeded by `executeFlow`) — or an empty object
        // for editor "Test step" runs.
        let item = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));
        Ok(NodeOutput::single(vec![item]))
    }
}
