use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct BambooHrNode;

#[async_trait]
impl Node for BambooHrNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bambooHr",
            "BambooHR",
            "HR management",
            NodeCategory::Hr,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for bambooHr
        Ok(NodeOutput::single(input.items))
    }
}
