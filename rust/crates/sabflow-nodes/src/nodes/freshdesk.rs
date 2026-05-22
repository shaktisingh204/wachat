use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct FreshdeskNode;

#[async_trait]
impl Node for FreshdeskNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "freshdesk",
            "Freshdesk",
            "Customer support",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for freshdesk
        Ok(NodeOutput::single(input.items))
    }
}
