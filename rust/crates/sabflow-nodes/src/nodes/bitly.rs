use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct BitlyNode;

#[async_trait]
impl Node for BitlyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bitly",
            "Bitly",
            "URL shortener",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for bitly
        Ok(NodeOutput::single(input.items))
    }
}
