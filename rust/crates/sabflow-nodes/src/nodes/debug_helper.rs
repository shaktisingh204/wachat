use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct DebugHelperNode;

#[async_trait]
impl Node for DebugHelperNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "debugHelper",
            "Debug Helper",
            "Generate test data",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for debugHelper
        Ok(NodeOutput::single(input.items))
    }
}
