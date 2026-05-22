use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct SseTriggerNode;

#[async_trait]
impl Node for SseTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sseTrigger",
            "SSE Trigger",
            "Server-Sent Events trigger",
            NodeCategory::Trigger,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for sseTrigger
        Ok(NodeOutput::single(input.items))
    }
}
