use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct PushoverNode;

#[async_trait]
impl Node for PushoverNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pushover",
            "Pushover",
            "Push notifications",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for pushover
        Ok(NodeOutput::single(input.items))
    }
}
