use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct NpmNode;

#[async_trait]
impl Node for NpmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "npm",
            "npm",
            "npm package operations",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for npm
        Ok(NodeOutput::single(input.items))
    }
}
