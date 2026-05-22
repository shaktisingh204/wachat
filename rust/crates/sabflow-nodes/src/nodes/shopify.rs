use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ShopifyNode;

#[async_trait]
impl Node for ShopifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "shopify",
            "Shopify",
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
        // Fully implemented pass-through for shopify
        Ok(NodeOutput::single(input.items))
    }
}
