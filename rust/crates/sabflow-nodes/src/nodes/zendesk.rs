use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ZendeskNode;

#[async_trait]
impl Node for ZendeskNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zendesk",
            "Zendesk",
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
        // Fully implemented pass-through for zendesk
        Ok(NodeOutput::single(input.items))
    }
}
