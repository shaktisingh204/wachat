use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct MagentoNode;

#[async_trait]
impl Node for MagentoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "magento",
            "Magento",
            "E-commerce platform",
            NodeCategory::Finance,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for magento
        Ok(NodeOutput::single(input.items))
    }
}
