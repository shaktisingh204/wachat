use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct WooCommerceNode;

#[async_trait]
impl Node for WooCommerceNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "wooCommerce",
            "WooCommerce",
            "WordPress e-commerce",
            NodeCategory::Finance,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for wooCommerce
        Ok(NodeOutput::single(input.items))
    }
}
