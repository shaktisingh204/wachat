//! Manual Trigger node — `n8n-nodes-base.manualTrigger`.
//!
//! The entry point that fires when a user clicks the "Execute workflow"
//! button in the editor. No external schedule, no webhook — just a one-shot
//! kick-off so the rest of the flow runs.
//!
//! Behaviour mirrors n8n exactly: emit a **single empty item** so any
//! downstream node that's keyed on "did anything arrive?" sees one tick.
//! When the editor passes ad-hoc test data (via `ExecutionContext::trigger_data`),
//! surface that payload instead so the manual-run + paste-JSON UX works.
//!
//! Like every trigger, this node has zero inputs and one output port.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct ManualTriggerNode;

#[async_trait]
impl Node for ManualTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "manualTrigger",
            "Manual Trigger",
            "Run the workflow manually from the editor's \"Execute workflow\" button.",
            NodeCategory::Trigger,
        )
        .icon("play")
        .color("#22c55e")
        .trigger()
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // n8n's manual trigger emits exactly one item. When the editor
        // supplied ad-hoc test data, forward it; otherwise emit an empty
        // object so a single item still flows out.
        let item = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));
        Ok(NodeOutput::single(vec![item]))
    }
}
