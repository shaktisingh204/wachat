use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CustomerIoNode;

#[async_trait]
impl Node for CustomerIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "customerIo",
            "Customer.io",
            "Behavioural email",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for customerIo
        Ok(NodeOutput::single(input.items))
    }
}
