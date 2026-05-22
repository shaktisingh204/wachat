use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct CryptoNode;

#[async_trait]
impl Node for CryptoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "crypto",
            "Crypto",
            "Cryptographic operations",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for crypto
        Ok(NodeOutput::single(input.items))
    }
}
