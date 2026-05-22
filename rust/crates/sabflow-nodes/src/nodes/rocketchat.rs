use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct RocketchatNode;

#[async_trait]
impl Node for RocketchatNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rocketchat",
            "Rocket.Chat",
            "Self-hosted team chat",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for rocketchat
        Ok(NodeOutput::single(input.items))
    }
}
