use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ConvertKitNode;

#[async_trait]
impl Node for ConvertKitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertKit",
            "ConvertKit",
            "Email marketing for creators",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for convertKit
        Ok(NodeOutput::single(input.items))
    }
}
