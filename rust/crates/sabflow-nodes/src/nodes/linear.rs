use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct LinearNode;

#[async_trait]
impl Node for LinearNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "linear",
            "Linear",
            "Issue tracking for software teams",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for linear
        Ok(NodeOutput::single(input.items))
    }
}
