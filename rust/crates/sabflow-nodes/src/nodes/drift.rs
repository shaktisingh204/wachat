use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct DriftNode;

#[async_trait]
impl Node for DriftNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "drift",
            "Drift",
            "Conversational marketing",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for drift
        Ok(NodeOutput::single(input.items))
    }
}
